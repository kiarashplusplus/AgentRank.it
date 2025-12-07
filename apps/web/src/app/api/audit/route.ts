import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { auth } from "@clerk/nextjs/server";

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
            // NOTE: D1 integration requires Cloudflare deployment
            // For now, allow unlimited for authenticated users in dev
            tier = "free";
            creditsRemaining = 50; // Placeholder until D1 is configured
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
        const response = {
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

        return NextResponse.json(response);
    } catch (error) {
        console.error("Audit error:", error);

        if (error instanceof Error) {
            // Check if it's a timeout
            if (error.message.includes("TIMEOUT")) {
                return NextResponse.json(
                    { error: "Audit timed out. The site may be unresponsive." },
                    { status: 504 }
                );
            }
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: "Unknown error occurred" },
            { status: 500 }
        );
    }
}
