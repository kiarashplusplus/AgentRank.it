import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";

// In-memory rate limiter for anonymous users
const anonymousLimits = new Map<string, { count: number; resetAt: number }>();
const ANONYMOUS_LIMIT = 3;
const ANONYMOUS_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// Browser-use engine endpoint (Docker container)
const ENGINE_URL = process.env.ENGINE_URL || "http://localhost:8001";

// Timeout constraints
const MIN_TIMEOUT_SECONDS = 30;
const MAX_TIMEOUT_SECONDS = 600;
const DEFAULT_TIMEOUT_SECONDS = 300;

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

interface TaskRequest {
    url: string;
    goal: string;
    timeout?: number; // seconds, default 300
}

interface EngineResponse {
    success: boolean;
    output?: string;
    steps?: number;
    transcript?: string[];
    videoUrl?: string;
    error?: string;
    inputTokens?: number;
    outputTokens?: number;
}

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        const body = (await request.json()) as TaskRequest;
        const { url, goal, timeout: requestedTimeout } = body;

        if (!url || typeof url !== "string") {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        if (!goal || typeof goal !== "string") {
            return NextResponse.json({ error: "Goal is required" }, { status: 400 });
        }

        // Validate and clamp timeout
        let timeoutSeconds = requestedTimeout ?? DEFAULT_TIMEOUT_SECONDS;
        if (typeof timeoutSeconds !== "number" || isNaN(timeoutSeconds)) {
            timeoutSeconds = DEFAULT_TIMEOUT_SECONDS;
        }
        timeoutSeconds = Math.max(MIN_TIMEOUT_SECONDS, Math.min(MAX_TIMEOUT_SECONDS, timeoutSeconds));
        const timeoutMs = timeoutSeconds * 1000;

        // Check authentication
        const { userId } = await auth();
        let creditsRemaining: number | null = null;
        let tier = "anonymous";

        if (userId) {
            tier = "free";
            creditsRemaining = 50;
        } else {
            const ip = getClientIp(request);
            const limitCheck = checkAnonymousLimit(ip);

            if (!limitCheck.allowed) {
                return NextResponse.json(
                    {
                        error: "Rate limit exceeded. Sign in for more tasks.",
                        creditsRemaining: 0,
                        tier: "anonymous",
                    },
                    { status: 429 }
                );
            }
            creditsRemaining = limitCheck.remaining;
        }

        // Call the browser-use engine
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const engineResponse = await fetch(`${ENGINE_URL}/task`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, task: goal }),
                signal: controller.signal,
            });

            clearTimeout(timeoutHandle);

            if (!engineResponse.ok) {
                const errorData = await engineResponse.json().catch(() => ({}));
                throw new Error((errorData as { error?: string }).error || `Engine error: ${engineResponse.status}`);
            }

            const result = (await engineResponse.json()) as EngineResponse;
            const durationMs = Date.now() - startTime;

            // Save to task history for authenticated users
            if (userId) {
                try {
                    await db.insertTaskHistory({
                        userId,
                        url,
                        goal,
                        timeoutSeconds,
                        success: result.success,
                        output: result.output,
                        error: result.error,
                        steps: result.steps,
                        durationMs,
                        videoUrl: result.videoUrl,
                        inputTokens: result.inputTokens,
                        outputTokens: result.outputTokens,
                        transcript: result.transcript,
                    });
                } catch (dbError) {
                    // Log but don't fail the request if history save fails
                    console.error("Failed to save task history:", dbError);
                }
            }

            return NextResponse.json({
                success: result.success,
                output: result.output,
                steps: result.steps || 0,
                transcript: result.transcript || [],
                videoUrl: result.videoUrl,
                error: result.error,
                inputTokens: result.inputTokens || 0,
                outputTokens: result.outputTokens || 0,
                durationMs,
                timeoutSeconds,
                creditsRemaining,
                tier,
                userId: userId || null,
            });
        } catch (fetchError) {
            clearTimeout(timeoutHandle);
            const durationMs = Date.now() - startTime;

            // Determine error message
            let errorMessage = "Unknown error";
            if (fetchError instanceof Error && fetchError.name === "AbortError") {
                errorMessage = `Task timed out after ${timeoutSeconds} seconds`;
            } else if (fetchError instanceof Error && fetchError.message.includes("ECONNREFUSED")) {
                errorMessage = "Browser engine not running. Start with: docker-compose up -d";
            } else if (fetchError instanceof Error) {
                errorMessage = fetchError.message;
            }

            // Save failed task to history for authenticated users
            if (userId) {
                try {
                    await db.insertTaskHistory({
                        userId,
                        url,
                        goal,
                        timeoutSeconds,
                        success: false,
                        error: errorMessage,
                        durationMs,
                    });
                } catch (dbError) {
                    console.error("Failed to save task history:", dbError);
                }
            }

            if (fetchError instanceof Error && fetchError.name === "AbortError") {
                return NextResponse.json(
                    { error: errorMessage, durationMs, timeoutSeconds },
                    { status: 504 }
                );
            }

            if (fetchError instanceof Error && fetchError.message.includes("ECONNREFUSED")) {
                return NextResponse.json(
                    { error: errorMessage },
                    { status: 503 }
                );
            }

            throw fetchError;
        }
    } catch (error) {
        console.error("Task error:", error);

        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
