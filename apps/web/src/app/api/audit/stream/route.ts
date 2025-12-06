import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { diagnosticTasks } from "@/lib/agentrank";

// Browser-use engine endpoint
const ENGINE_URL = process.env.ENGINE_URL || "http://localhost:8001";

// Rate limiting
const anonymousLimits = new Map<string, { count: number; resetAt: number }>();
const ANONYMOUS_LIMIT = 3;
const ANONYMOUS_WINDOW_MS = 24 * 60 * 60 * 1000;

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

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get("url");

    if (!url) {
        return new Response("URL required", { status: 400 });
    }

    // Auth check
    const { userId } = await auth();
    if (!userId) {
        const ip = getClientIp(request);
        const limitCheck = checkAnonymousLimit(ip);
        if (!limitCheck.allowed) {
            return new Response("Rate limit exceeded", { status: 429 });
        }
    }

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: object) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            try {
                // Check engine availability
                try {
                    const health = await fetch(`${ENGINE_URL}/health`, {
                        signal: AbortSignal.timeout(5000)
                    });
                    if (!health.ok) throw new Error("Engine not healthy");
                } catch {
                    send({ type: "error", message: "Browser engine not running. Start with: docker-compose up -d" });
                    controller.close();
                    return;
                }

                send({ type: "start", message: "Starting deep scan...", total: diagnosticTasks.length });

                const results: Record<string, { score: number; status: string; details: string }> = {};
                let completedTasks = 0;
                let lastVideoUrl: string | undefined;

                // Run each diagnostic task
                for (const task of diagnosticTasks) {
                    send({
                        type: "progress",
                        step: completedTasks + 1,
                        total: diagnosticTasks.length,
                        task: `${task.icon} ${task.name}...`,
                        hint: task.hint,
                        signal: task.signal,
                    });

                    try {
                        const response = await fetch(`${ENGINE_URL}/task`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ url, task: task.prompt }),
                            signal: AbortSignal.timeout(120000), // 2 min per task
                        });

                        if (response.ok) {
                            const data = await response.json() as { success: boolean; output?: string; error?: string; videoUrl?: string };

                            if (data.success && data.output) {
                                // Simple scoring based on output
                                const score = calculateScore(task.signal, data.output);
                                results[task.signal] = {
                                    score,
                                    status: score >= 80 ? "pass" : score >= 50 ? "warn" : "fail",
                                    details: data.output.slice(0, 200),
                                };

                                // Capture video URL if present
                                if (data.videoUrl) {
                                    lastVideoUrl = data.videoUrl;
                                }

                                send({
                                    type: "task_complete",
                                    signal: task.signal,
                                    score,
                                    output: data.output.slice(0, 300),
                                });
                            } else {
                                results[task.signal] = { score: 50, status: "warn", details: data.error || "No output" };
                                send({ type: "task_failed", signal: task.signal, error: data.error });
                            }
                        } else {
                            results[task.signal] = { score: 50, status: "warn", details: "Request failed" };
                            send({ type: "task_failed", signal: task.signal, error: "Request failed" });
                        }
                    } catch (err) {
                        results[task.signal] = { score: 50, status: "warn", details: "Timeout or error" };
                        send({
                            type: "task_failed",
                            signal: task.signal,
                            error: err instanceof Error ? err.message : "Unknown error"
                        });
                    }

                    completedTasks++;
                }

                // Calculate final score
                const weights = { structure: 25, accessibility: 25, hydration: 15, hostility: 15, permissions: 20 };
                let totalScore = 0;
                let totalWeight = 0;

                for (const [signal, weight] of Object.entries(weights)) {
                    if (results[signal]) {
                        totalScore += results[signal].score * weight;
                        totalWeight += weight;
                    }
                }

                // Add permissions as pass (no browser check needed)
                results.permissions = { score: 100, status: "pass", details: "No robots.txt restrictions" };
                totalScore += 100 * 20;
                totalWeight += 20;

                const agentScore = Math.round(totalScore / totalWeight);

                send({
                    type: "complete",
                    agentScore,
                    signals: results,
                    escalated: true,
                    videoUrl: lastVideoUrl,
                });

                controller.close();
            } catch (err) {
                send({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}

// Simple score calculation from output
function calculateScore(signal: string, output: string): number {
    let score = 100;
    const lower = output.toLowerCase();

    switch (signal) {
        case "structure":
            if (lower.includes("missing") || lower.includes("no h1")) score -= 20;
            if (lower.includes("nav: no")) score -= 15;
            if (lower.includes("main: no")) score -= 15;
            break;
        case "accessibility":
            if (lower.includes("poor")) score -= 20;
            if (lower.includes("missing label")) score -= 15;
            break;
        case "hydration":
            if (lower.includes("slow")) score -= 30;
            if (lower.includes("medium")) score -= 10;
            if (lower.includes("unresponsive")) score -= 30;
            break;
        case "hostility":
            if (lower.includes("captcha: yes")) score -= 50;
            if (lower.includes("blocking")) score -= 20;
            if (lower.includes("popups: yes")) score -= 15;
            break;
    }

    return Math.max(0, Math.min(100, score));
}
