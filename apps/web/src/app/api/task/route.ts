import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// In-memory rate limiter for anonymous users
const anonymousLimits = new Map<string, { count: number; resetAt: number }>();
const ANONYMOUS_LIMIT = 3;
const ANONYMOUS_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// Browser-use engine endpoint (Docker container)
const ENGINE_URL = process.env.ENGINE_URL || "http://localhost:8001";

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
}

interface EngineResponse {
    success: boolean;
    output?: string;
    steps?: number;
    transcript?: string[];
    videoUrl?: string;
    error?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as TaskRequest;
        const { url, goal } = body;

        if (!url || typeof url !== "string") {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        if (!goal || typeof goal !== "string") {
            return NextResponse.json({ error: "Goal is required" }, { status: 400 });
        }

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
        const timeout = setTimeout(() => controller.abort(), 300000); // 5 min timeout

        try {
            const engineResponse = await fetch(`${ENGINE_URL}/task`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, task: goal }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!engineResponse.ok) {
                const errorData = await engineResponse.json().catch(() => ({}));
                throw new Error((errorData as { error?: string }).error || `Engine error: ${engineResponse.status}`);
            }

            const result = (await engineResponse.json()) as EngineResponse;

            return NextResponse.json({
                success: result.success,
                output: result.output,
                steps: result.steps || 0,
                transcript: result.transcript || [],
                videoUrl: result.videoUrl,
                error: result.error,
                creditsRemaining,
                tier,
                userId: userId || null,
            });
        } catch (fetchError) {
            clearTimeout(timeout);

            if (fetchError instanceof Error && fetchError.name === "AbortError") {
                return NextResponse.json(
                    { error: "Task timed out after 5 minutes" },
                    { status: 504 }
                );
            }

            // Check if engine is not running
            if (fetchError instanceof Error && fetchError.message.includes("ECONNREFUSED")) {
                return NextResponse.json(
                    { error: "Browser engine not running. Start with: docker-compose up -d" },
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
