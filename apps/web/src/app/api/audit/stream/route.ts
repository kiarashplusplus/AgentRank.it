import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import deepScanConfig from "@/config/deep-scan.json";

// Browser-use engine endpoint
const ENGINE_URL = process.env.ENGINE_URL || "http://localhost:8001";

// Load tasks from config (only enabled ones)
interface TaskConfig {
    name: string;
    signal: string;
    weight: number;
    icon: string;
    hint: string;
    enabled: boolean;
    prompt: string;
}

function getEnabledTasks(limit?: number): TaskConfig[] {
    const enabled = (deepScanConfig.tasks as TaskConfig[]).filter(t => t.enabled);
    const maxFromConfig = deepScanConfig.maxTasks;
    const effectiveLimit = limit ?? maxFromConfig ?? enabled.length;
    return enabled.slice(0, effectiveLimit);
}

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
    // Secret: ?tasks=1 to limit number of tasks for testing
    const tasksParam = request.nextUrl.searchParams.get("tasks");
    const taskLimit = tasksParam ? parseInt(tasksParam, 10) : undefined;

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

                send({ type: "start", message: "Starting deep scan...", total: getEnabledTasks(taskLimit).length });

                const results: Record<string, { score: number; status: string; details: string }> = {};
                let completedTasks = 0;
                let lastVideoUrl: string | undefined;
                const tasksToRun = getEnabledTasks(taskLimit);

                // Run each diagnostic task
                for (const task of tasksToRun) {
                    send({
                        type: "progress",
                        step: completedTasks + 1,
                        total: tasksToRun.length,
                        task: `${task.icon} ${task.name}...`,
                        hint: task.hint,
                        signal: task.signal,
                    });

                    try {
                        const response = await fetch(`${ENGINE_URL}/task`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ url, task: task.prompt }),
                            signal: AbortSignal.timeout(300000), // 5 min per task
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

                // Calculate final score using weights from config
                let totalScore = 0;
                let totalWeight = 0;

                for (const task of tasksToRun) {
                    if (results[task.signal]) {
                        totalScore += results[task.signal].score * task.weight;
                        totalWeight += task.weight;
                    }
                }

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

// Score calculation based on structured output from prompts
function calculateScore(signal: string, output: string): number {
    let score = 100;
    const lower = output.toLowerCase();

    switch (signal) {
        case "permissions":
            // ROBOTS_STATUS: [ALLOWED/BLOCKED/UNKNOWN], TOKEN_ESTIMATE: [LOW/MED/HIGH], CONTEXT_TRAP: [YES/NO]
            if (lower.includes("robots_status: blocked")) score -= 40;
            if (lower.includes("robots_status: unknown")) score -= 10;
            if (lower.includes("token_estimate: high")) score -= 30;
            if (lower.includes("token_estimate: med")) score -= 15;
            if (lower.includes("context_trap: yes")) score -= 20;
            break;
        case "structure":
            // PRIMARY_ACTION_REACHABLE: [YES/NO], SEMANTIC_DENSITY: [HIGH/LOW], LANDMARKS_DETECTED
            if (lower.includes("primary_action_reachable: no")) score -= 25;
            if (lower.includes("semantic_density: low")) score -= 25;
            if (!lower.includes("nav") && !lower.includes("main")) score -= 20;
            break;
        case "accessibility":
            // AMBIGUOUS_LINKS: [Count], GHOST_BUTTONS: [Count], LABEL_INTEGRITY: [PASS/FAIL]
            if (lower.includes("label_integrity: fail")) score -= 30;
            const ghostMatch = output.match(/ghost_buttons:\s*(\d+)/i);
            if (ghostMatch && parseInt(ghostMatch[1]) > 0) score -= Math.min(30, parseInt(ghostMatch[1]) * 5);
            const ambigMatch = output.match(/ambiguous_links:\s*(\d+)/i);
            if (ambigMatch && parseInt(ambigMatch[1]) > 3) score -= 20;
            break;
        case "hydration":
            // LATE_HYDRATION: [YES/NO], SKELETON_LOADERS: [YES/NO], STABILITY_SCORE: [1-100]
            if (lower.includes("late_hydration: yes")) score -= 25;
            if (lower.includes("skeleton_loaders: yes")) score -= 15;
            const stabilityMatch = output.match(/stability_score:\s*(\d+)/i);
            if (stabilityMatch) {
                const stability = parseInt(stabilityMatch[1]);
                if (stability < 50) score -= 30;
                else if (stability < 80) score -= 15;
            }
            break;
        case "hostility":
            // HARD_BLOCKER: [YES/NO], SOFT_BLOCKER: [YES/NO], TRAP_DETECTED: [YES/NO]
            if (lower.includes("hard_blocker: yes")) score -= 50;
            if (lower.includes("soft_blocker: yes") && !lower.includes("dismissable")) score -= 20;
            if (lower.includes("trap_detected: yes")) score -= 30;
            break;
    }

    return Math.max(0, Math.min(100, score));
}
