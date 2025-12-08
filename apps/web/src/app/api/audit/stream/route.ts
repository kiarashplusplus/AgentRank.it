import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import deepScanConfig from "@/config/deep-scan.json";

// Configure max duration for long-running deep scans (5 minutes)
export const maxDuration = 300;

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
    const prepPrompt = request.nextUrl.searchParams.get("prepPrompt");
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

                const tasksToRun = getEnabledTasks(taskLimit);
                const totalSteps = prepPrompt ? tasksToRun.length + 1 : tasksToRun.length;
                send({ type: "start", message: "Starting deep scan...", total: totalSteps });

                // Build scan request for unified endpoint (single browser session)
                const scanTasks = tasksToRun.map(task => ({
                    name: task.name,
                    signal: task.signal,
                    prompt: task.prompt,
                }));

                // Call unified scan endpoint - runs ALL tasks in ONE browser session
                const response = await fetch(`${ENGINE_URL}/scan/stream`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        url,
                        tasks: scanTasks,
                        prep_prompt: prepPrompt || null,
                    }),
                    signal: AbortSignal.timeout(600000), // 10 min total timeout
                });

                if (!response.ok || !response.body) {
                    send({ type: "error", message: "Failed to connect to browser engine" });
                    controller.close();
                    return;
                }

                const results: Record<string, { score: number; status: string; details: string }> = {};
                let lastVideoUrl: string | undefined;


                // Process SSE stream from Python engine
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            try {
                                const event = JSON.parse(line.slice(6));

                                if (event.type === "start") {
                                    // Already sent our start, but could update if needed
                                } else if (event.type === "progress") {
                                    // Forward task progress
                                    const taskConfig = tasksToRun.find(t => t.signal === event.signal);
                                    send({
                                        type: "progress",
                                        step: event.task_index,
                                        total: totalSteps,
                                        task: event.signal === "prep"
                                            ? "🛡️ Running prep action..."
                                            : `${taskConfig?.icon || "📋"} ${event.name}...`,
                                        hint: event.signal === "prep"
                                            ? "Bypassing blockers before scan"
                                            : (taskConfig?.hint || ""),
                                        signal: event.signal,
                                    });
                                } else if (event.type === "step") {
                                    // Forward agent steps
                                    send({
                                        type: "agent_step",
                                        signal: event.signal || "scan",
                                        step: event.step,
                                        action: event.action,
                                        status: event.status,
                                    });
                                } else if (event.type === "task_complete") {

                                    if (event.signal !== "prep") {
                                        // Calculate score for diagnostic tasks
                                        const score = calculateScore(event.signal, event.output || "");
                                        results[event.signal] = {
                                            score,
                                            status: score >= 80 ? "pass" : score >= 50 ? "warn" : "fail",
                                            details: (event.output || "").slice(0, 200),
                                        };
                                        send({
                                            type: "task_complete",
                                            signal: event.signal,
                                            score,
                                            output: (event.output || "").slice(0, 300),
                                        });
                                    } else {
                                        send({
                                            type: "task_complete",
                                            signal: "prep",
                                            score: 100,
                                            output: "Prep action completed",
                                        });
                                    }
                                } else if (event.type === "task_failed") {
                                    if (event.signal !== "prep") {
                                        results[event.signal] = { score: 50, status: "warn", details: event.error || "Failed" };
                                    }
                                    send({ type: "task_failed", signal: event.signal, error: event.error });
                                } else if (event.type === "complete") {
                                    // Scan finished - calculate final score
                                    if (event.videoUrl) {
                                        lastVideoUrl = event.videoUrl;
                                    }

                                    // Capture token usage from Python engine
                                    const totalInputTokens = event.totalInputTokens || 0;
                                    const totalOutputTokens = event.totalOutputTokens || 0;

                                    // Calculate weighted score
                                    let totalScore = 0;
                                    let totalWeight = 0;

                                    for (const task of tasksToRun) {
                                        if (results[task.signal]) {
                                            totalScore += results[task.signal].score * task.weight;
                                            totalWeight += task.weight;
                                        }
                                    }

                                    const agentScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 50;

                                    // Save to audit history for authenticated users
                                    if (userId) {
                                        try {
                                            await db.insertAuditHistory({
                                                userId,
                                                url: url as string,
                                                agentScore,
                                                mode: "deep",
                                                escalated: true,
                                                costUsd: 20000, // $0.02 in microdollars for deep scan
                                                inputTokens: totalInputTokens,
                                                outputTokens: totalOutputTokens,
                                                resultJson: JSON.stringify({ signals: results, videoUrl: lastVideoUrl }),
                                            });
                                        } catch (historyError) {
                                            console.error("Failed to save audit history:", historyError);
                                        }
                                    }

                                    send({
                                        type: "complete",
                                        agentScore,
                                        signals: results,
                                        escalated: true,
                                        videoUrl: lastVideoUrl,
                                        inputTokens: totalInputTokens,
                                        outputTokens: totalOutputTokens,
                                    });
                                } else if (event.type === "error") {
                                    send({ type: "error", message: event.message });
                                }
                            } catch {
                                // Ignore parse errors
                            }
                        }
                    }
                }

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
