import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import robotsParser from "robots-parser";

const execAsync = promisify(exec);

// In-memory rate limiter for anonymous users (from Phase 1)
const anonymousLimits = new Map<string, { count: number; resetAt: number }>();
const ANONYMOUS_LIMIT = 3;
const ANONYMOUS_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

function getClientIp(request: NextRequest): string {
    return (
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown"
    );
}

function checkAnonymousLimit(ip: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const record = anonymousLimits.get(ip);

    if (!record || now > record.resetAt) {
        anonymousLimits.set(ip, { count: 1, resetAt: now + ANONYMOUS_WINDOW_MS });
        return { allowed: true, remaining: ANONYMOUS_LIMIT - 1 };
    }

    if (record.count >= ANONYMOUS_LIMIT) {
        return { allowed: false, remaining: 0 };
    }

    record.count++;
    return { allowed: true, remaining: ANONYMOUS_LIMIT - record.count };
}

/**
 * Check if a URL is blocked by robots.txt using robots-parser library
 */
async function checkRobotsTxt(targetUrl: string): Promise<{ blocked: boolean; rule?: string }> {
    try {
        const parsedUrl = new URL(targetUrl);
        const robotsTxtUrl = parsedUrl.origin + "/robots.txt";

        const robotsRes = await fetch(robotsTxtUrl, {
            signal: AbortSignal.timeout(5000),
            headers: { "User-Agent": "AgentRank/1.0" }
        });

        if (!robotsRes.ok) {
            return { blocked: false };
        }

        const robotsTxt = await robotsRes.text();

        // Parse robots.txt
        const robots = robotsParser(robotsTxtUrl, robotsTxt);

        // Check if we're allowed to access this URL
        // First check as AgentRank, then as generic bot (*)
        const isAllowedForAgentRank = robots.isAllowed(targetUrl, "AgentRank");
        const isAllowedForAny = robots.isAllowed(targetUrl, "*");

        // Blocked if explicitly disallowed
        // robots.isAllowed returns true if allowed, false if disallowed, undefined if no match
        const isBlocked = isAllowedForAgentRank === false || isAllowedForAny === false;

        if (isBlocked) {
            return {
                blocked: true,
                rule: `URL ${targetUrl} is disallowed by robots.txt`
            };
        }

        return { blocked: false };
    } catch (err) {
        // robots.txt not found or error = allowed
        console.error("robots.txt check error:", err);
        return { blocked: false };
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as { url?: string; mode?: "quick" | "deep" };
        const { url, mode = "quick" } = body;

        if (!url || typeof url !== "string") {
            return NextResponse.json(
                { error: "URL is required" },
                { status: 400 }
            );
        }

        // Check authentication
        const { userId } = await auth();
        let creditsRemaining: number | null = null;
        let tier = "anonymous";

        if (userId) {
            // Authenticated user - check credits from D1
            const scanType: "quick" | "deep" = mode === "deep" ? "deep" : "quick";
            const creditCheck = await db.checkCredits(userId, scanType);

            if (!creditCheck.allowed) {
                return NextResponse.json(
                    {
                        error: `No ${scanType} scans remaining. Your credits reset ${creditCheck.resetAt ? creditCheck.resetAt.toLocaleDateString() : 'next month'}.`,
                        creditsRemaining: 0,
                        tier: creditCheck.tier,
                    },
                    { status: 429 }
                );
            }

            tier = creditCheck.tier;
            creditsRemaining = creditCheck.remaining;
        } else {
            // Anonymous user - check IP-based rate limit
            const ip = getClientIp(request);
            const limitCheck = checkAnonymousLimit(ip);

            if (!limitCheck.allowed) {
                return NextResponse.json(
                    {
                        error: "Rate limit exceeded. Sign in for more scans.",
                        creditsRemaining: 0,
                        tier: "anonymous",
                    },
                    { status: 429 }
                );
            }
            creditsRemaining = limitCheck.remaining;
        }

        // Check robots.txt on ORIGINAL URL before following redirects
        // This catches cases like google.com/groups which redirects but is disallowed
        const robotsCheck = await checkRobotsTxt(url);
        if (robotsCheck.blocked) {
            return NextResponse.json(
                { error: `This URL is disallowed by robots.txt: ${robotsCheck.rule}` },
                { status: 403 }
            );
        }

        // Validate URL is reachable and returns 2xx before running scan
        let targetUrl = url;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, {
                method: "GET",
                redirect: "follow",
                signal: controller.signal,
                headers: {
                    "User-Agent": "AgentRank/1.0 URL Validator"
                }
            });
            clearTimeout(timeoutId);

            // Update URL to final destination after redirects
            targetUrl = response.url;

            // Require 2xx status code
            if (response.status < 200 || response.status >= 300) {
                return NextResponse.json(
                    { error: `URL returned status ${response.status} (expected 200-299): ${targetUrl}` },
                    { status: 400 }
                );
            }
        } catch (fetchError) {
            const errorMessage = fetchError instanceof Error ? fetchError.message : "Unknown error";
            if (errorMessage.includes("abort")) {
                return NextResponse.json(
                    { error: `URL timed out after 10 seconds: ${url}` },
                    { status: 400 }
                );
            }
            return NextResponse.json(
                { error: `URL is unreachable: ${url}. ${errorMessage}` },
                { status: 400 }
            );
        }

        // If redirected to a different origin, also check the new origin's robots.txt
        const originalOrigin = new URL(url).origin;
        const targetOrigin = new URL(targetUrl).origin;
        if (originalOrigin !== targetOrigin) {
            const redirectRobotsCheck = await checkRobotsTxt(targetUrl);
            if (redirectRobotsCheck.blocked) {
                return NextResponse.json(
                    { error: `Redirected URL is disallowed by robots.txt: ${redirectRobotsCheck.rule}` },
                    { status: 403 }
                );
            }
        }

        // (robots.txt already checked above for both original and redirected URLs)

        // Path to the AgentRank CLI (relative to monorepo root)
        const cliPath = path.resolve(process.cwd(), "../../dist/cli/index.js");

        // Deep mode requires more time for Skyvern analysis
        const timeout = mode === "deep" ? 180000 : 60000;

        // Run the audit command with mode (use validated/redirected URL)
        const { stdout, stderr } = await execAsync(
            `node "${cliPath}" audit "${targetUrl}" --mode ${mode} --json`,
            {
                timeout,
                cwd: path.resolve(process.cwd(), "../.."),
            }
        );

        if (stderr) {
            console.error("CLI stderr:", stderr);
        }

        // Parse the JSON output
        const result = JSON.parse(stdout);

        // Transform to match our frontend interface
        const responseData = {
            url: result.meta?.url || url,
            agentScore: result.agentScore || result.agent_score || 0,
            mode: result.meta?.scanMode || mode,
            costUsd: result.meta?.costUsd || 0.002,
            escalated: result.escalation?.triggered || false,
            signals: Object.entries(result.signals || {}).map(([name, signal]: [string, unknown]) => {
                const s = signal as { status: string; score: number; weight: number; details: string; recommendations?: string[] };
                return {
                    name,
                    status: s.status as "pass" | "warn" | "fail",
                    score: s.score || 0,
                    weight: s.weight || 0,
                    details: s.details || "",
                    recommendations: s.recommendations || [],
                };
            }),
            // Credit info
            creditsRemaining,
            tier,
            userId: userId || null,
        };

        // Save to audit history and deduct credits for authenticated users
        if (userId) {
            try {
                await db.insertAuditHistory({
                    userId,
                    url: responseData.url,
                    agentScore: responseData.agentScore,
                    mode: responseData.mode,
                    escalated: responseData.escalated,
                    costUsd: Math.round((responseData.costUsd || 0) * 1000000), // Convert to microdollars
                    resultJson: JSON.stringify(result),
                });

                // Deduct credit after successful scan
                const scanType: "quick" | "deep" = mode === "deep" ? "deep" : "quick";
                await db.deductCredit(userId, scanType);

                // Update creditsRemaining to reflect the deduction
                if (creditsRemaining !== null && creditsRemaining > 0) {
                    creditsRemaining = creditsRemaining - 1;
                    responseData.creditsRemaining = creditsRemaining;
                }
            } catch (historyError) {
                // Log but don't fail the request if history save fails
                console.error("Failed to save audit history or deduct credit:", historyError);
            }
        }

        return NextResponse.json(responseData);
    } catch (error) {
        console.error("Audit error:", error);

        if (error instanceof Error) {
            // Check if it's a timeout
            if (error.message.includes("TIMEOUT") || error.message.includes("timed out")) {
                return NextResponse.json(
                    { error: "The scan timed out. The URL might be too slow or complex." },
                    { status: 504 }
                );
            }

            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: "Failed to run audit" },
            { status: 500 }
        );
    }
}
