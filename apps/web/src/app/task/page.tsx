"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Clock, Zap, History } from "lucide-react";

interface TaskResult {
    success: boolean;
    output?: string;
    steps?: number;
    transcript?: string[];
    videoUrl?: string;
    error?: string;
    creditsRemaining?: number;
    tier?: string;
    inputTokens?: number;
    outputTokens?: number;
    durationMs?: number;
    timeoutSeconds?: number;
}

export default function TaskPage() {
    const { user } = useUser();
    const [url, setUrl] = useState("");
    const [goal, setGoal] = useState("");
    const [timeout, setTimeout] = useState(300); // default 5 minutes
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<TaskResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [showTranscript, setShowTranscript] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url || !goal) return;

        setIsLoading(true);
        setError(null);
        setResult(null);
        setElapsedTime(0);
        setShowTranscript(false);

        // Start timer
        const startTime = Date.now();
        const timer = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);

        try {
            const response = await fetch("/api/task", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, goal, timeout }),
            });

            const data = (await response.json()) as TaskResult & { error?: string };

            if (!response.ok) {
                throw new Error(data.error || "Task failed");
            }

            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error occurred");
        } finally {
            clearInterval(timer);
            setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
            setIsLoading(false);
        }
    };

    const formatTime = (seconds: number): string => {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    const formatTokens = (tokens: number): string => {
        if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
        return tokens.toString();
    };

    return (
        <>
            <Header />
            <main className="min-h-screen bg-background">
                <div className="container mx-auto py-10 px-4 max-w-3xl">
                    {/* Header */}
                    <div className="mb-8 flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Browser Task</h1>
                            <p className="text-muted-foreground mt-2">
                                Run browser automation tasks with AI-powered vision
                            </p>
                        </div>
                        {user && (
                            <Link
                                href="/task/history"
                                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border rounded-md hover:bg-muted"
                            >
                                <History className="h-4 w-4" />
                                History
                            </Link>
                        )}
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4 mb-8">
                        <div>
                            <label htmlFor="url" className="block text-sm font-medium mb-2">
                                URL
                            </label>
                            <input
                                id="url"
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://example.com"
                                className="w-full rounded-lg border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label htmlFor="goal" className="block text-sm font-medium mb-2">
                                Goal
                            </label>
                            <textarea
                                id="goal"
                                value={goal}
                                onChange={(e) => setGoal(e.target.value)}
                                placeholder="Click the Sign Up button and fill in the email field"
                                className="w-full rounded-lg border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px] resize-none"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        {/* Timeout Slider */}
                        <div className="p-4 rounded-lg border bg-card">
                            <div className="flex items-center justify-between mb-2">
                                <label htmlFor="timeout" className="text-sm font-medium flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    Timeout
                                </label>
                                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                    {formatTime(timeout)}
                                </span>
                            </div>
                            <input
                                id="timeout"
                                type="range"
                                min={30}
                                max={600}
                                step={30}
                                value={timeout}
                                onChange={(e) => setTimeout(parseInt(e.target.value, 10))}
                                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                                disabled={isLoading}
                            />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>30s</span>
                                <span>5m</span>
                                <span>10m</span>
                            </div>
                        </div>

                        <Button type="submit" disabled={isLoading || !url || !goal} className="w-full">
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    Running... ({formatTime(elapsedTime)})
                                </span>
                            ) : (
                                "Run Task"
                            )}
                        </Button>
                    </form>

                    {/* Error */}
                    {error && (
                        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 mb-8">
                            <p className="text-sm text-destructive">{error}</p>
                        </div>
                    )}

                    {/* Result */}
                    {result && (
                        <div className="rounded-lg border bg-card p-6 space-y-4">
                            <div className="flex items-center gap-3">
                                {result.success ? (
                                    <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                        <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                ) : (
                                    <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                        <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </div>
                                )}
                                <div>
                                    <h2 className="text-lg font-semibold">
                                        {result.success ? "Task Completed" : "Task Failed"}
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        {result.durationMs ? formatTime(Math.floor(result.durationMs / 1000)) : formatTime(elapsedTime)} • {result.steps || 0} steps
                                    </p>
                                </div>
                            </div>

                            {result.output && (
                                <div className="pt-4 border-t">
                                    <h3 className="text-sm font-medium mb-2">Result</h3>
                                    <p className="text-sm text-muted-foreground">{result.output}</p>
                                </div>
                            )}

                            {result.error && (
                                <div className="pt-4 border-t">
                                    <h3 className="text-sm font-medium mb-2 text-destructive">Error</h3>
                                    <p className="text-sm text-destructive/80">{result.error}</p>
                                </div>
                            )}

                            {/* Transcript */}
                            {result.transcript && result.transcript.length > 0 && (
                                <div className="pt-4 border-t">
                                    <button
                                        onClick={() => setShowTranscript(!showTranscript)}
                                        className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors w-full"
                                    >
                                        {showTranscript ? (
                                            <ChevronUp className="h-4 w-4" />
                                        ) : (
                                            <ChevronDown className="h-4 w-4" />
                                        )}
                                        Agent Transcript ({result.transcript.length} steps)
                                    </button>
                                    {showTranscript && (
                                        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                                            {result.transcript.map((step, idx) => (
                                                <div
                                                    key={idx}
                                                    className="p-2 rounded bg-muted/50 text-xs font-mono text-muted-foreground"
                                                >
                                                    <span className="text-primary mr-2">[{idx + 1}]</span>
                                                    {step.length > 200 ? step.slice(0, 200) + "..." : step}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {result.creditsRemaining !== undefined && (
                                <div className="pt-4 border-t text-xs text-muted-foreground">
                                    {result.creditsRemaining} credits remaining ({result.tier} tier)
                                </div>
                            )}

                            {/* Video Replay */}
                            {result.videoUrl && (
                                <div className="pt-4 border-t">
                                    <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                                        <span>🎥</span> Agent Replay
                                    </h3>
                                    <div className="rounded-lg overflow-hidden border bg-black">
                                        <video
                                            src={result.videoUrl}
                                            controls
                                            className="w-full"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Watch the AI agent navigate the page
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Empty state */}
                    {!result && !isLoading && !error && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="rounded-full bg-muted p-4 mb-4">
                                <svg className="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold">Ready to automate</h3>
                            <p className="text-muted-foreground mt-1">
                                Enter a URL and describe what you want the AI to do
                            </p>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}
