"use client";

import { useState } from "react";
import { ScoreGauge } from "@/components/score-gauge";
import { SignalCards } from "@/components/signal-cards";
import { UrlInput } from "@/components/url-input";
import { Header } from "@/components/header";

interface Signal {
  name: string;
  status: "pass" | "warn" | "fail";
  score: number;
  weight: number;
  details: string;
  recommendations?: string[];
}

interface AuditResult {
  url: string;
  agentScore: number;
  mode: string;
  costUsd: number;
  escalated: boolean;
  signals: Signal[];
  creditsRemaining: number | null;
  tier: string;
  userId: string | null;
}

interface ProgressState {
  step: number;
  total: number;
  task: string;
  hint: string;
  outputs: string[];
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [scanMode, setScanMode] = useState<"quick" | "deep">("quick");

  const handleAudit = async (url: string, mode: "quick" | "deep" = "quick") => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setProgress(null);
    setScanMode(mode);

    try {
      if (mode === "deep") {
        // Use streaming endpoint for deep scan
        const eventSource = new EventSource(`/api/audit/stream?url=${encodeURIComponent(url)}`);

        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);

          if (data.type === "start") {
            setProgress({ step: 0, total: data.total, task: data.message, hint: "", outputs: [] });
          } else if (data.type === "progress") {
            setProgress(prev => ({
              step: data.step,
              total: data.total,
              task: data.task,
              hint: data.hint || "",
              outputs: prev?.outputs || [],
            }));
          } else if (data.type === "task_complete") {
            setProgress(prev => ({
              ...prev!,
              outputs: [...(prev?.outputs || []), `${data.output?.slice(0, 150) || "Completed"}`],
            }));
          } else if (data.type === "task_failed") {
            setProgress(prev => ({
              ...prev!,
              outputs: [...(prev?.outputs || []), `⚠️ ${data.error || "Task failed"}`],
            }));
          } else if (data.type === "complete") {
            eventSource.close();
            setResult({
              url,
              agentScore: data.agentScore,
              mode: "deep",
              costUsd: 0.02,
              escalated: data.escalated,
              signals: Object.entries(data.signals).map(([name, sig]) => ({
                name,
                status: (sig as { status: string }).status as "pass" | "warn" | "fail",
                score: (sig as { score: number }).score,
                weight: name === "permissions" ? 20 : name === "structure" || name === "accessibility" ? 25 : 15,
                details: (sig as { details: string }).details,
              })),
              creditsRemaining: null,
              tier: "free",
              userId: null,
            });
            setIsLoading(false);
            setProgress(null);
          } else if (data.type === "error") {
            eventSource.close();
            setError(data.message);
            setIsLoading(false);
            setProgress(null);
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          setError("Connection lost to scan server");
          setIsLoading(false);
          setProgress(null);
        };

        return; // Don't continue to finally block
      }

      // Quick mode - use regular API
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, mode }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Audit failed");
      }

      const data = (await response.json()) as AuditResult;
      setResult(data);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background">
        <div className="container mx-auto py-10 px-4">
          {/* Hero Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">
              Agent Visibility Score
            </h1>
            <p className="text-muted-foreground mt-2">
              Measure how reliably an AI agent can navigate your website
            </p>
          </div>

          {/* URL Input */}
          <div className="mb-8 max-w-2xl">
            <UrlInput onSubmit={handleAudit} isLoading={isLoading} />
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-8 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="mb-8 rounded-lg border bg-card p-6 max-w-2xl">
              {progress && scanMode === "deep" ? (
                <>
                  {/* Progress Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
                    <div>
                      <p className="font-medium">{progress.task}</p>
                      <p className="text-xs text-muted-foreground">
                        Step {progress.step} of {progress.total}
                      </p>
                      {progress.hint && (
                        <p className="text-xs text-muted-foreground/70 mt-1 italic">
                          {progress.hint}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${(progress.step / progress.total) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Think-Aloud Outputs */}
                  {progress.outputs.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {progress.outputs.map((output, idx) => (
                        <div key={idx} className="text-sm text-muted-foreground bg-muted/50 rounded p-2">
                          {output}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <p className="mt-4 text-muted-foreground">
                    {scanMode === "deep" ? "Starting deep scan..." : "Scanning site..."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {result && !isLoading && (
            <>
              {/* Score Section */}
              <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
                {/* Main Gauge */}
                <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-6">
                  <ScoreGauge score={result.agentScore} size={220} />
                  <p className="mt-4 text-sm text-muted-foreground text-center">
                    Your site is{" "}
                    <span className="font-medium text-foreground">
                      {result.agentScore >= 80
                        ? "Agent Ready"
                        : result.agentScore >= 60
                          ? "Partially Agent Ready"
                          : "Not Agent Ready"}
                    </span>
                  </p>
                </div>

                {/* URL & Metadata */}
                <div className="flex flex-col gap-4">
                  <div className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold mb-4">Audit Result</h2>
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">URL</span>
                        <span className="font-mono truncate max-w-[300px]">
                          {result.url}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mode</span>
                        <span className="capitalize">{result.mode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cost</span>
                        <span>${result.costUsd.toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Escalated</span>
                        <span>{result.escalated ? "Yes" : "No"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Credits Info */}
                  <div className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold mb-4">Credits</h2>
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tier</span>
                        <span className="capitalize font-medium">
                          {result.tier}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Remaining</span>
                        <span className={result.creditsRemaining === 0 ? "text-destructive" : ""}>
                          {result.creditsRemaining ?? "Unlimited"}
                        </span>
                      </div>
                      {result.tier === "anonymous" && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Sign in for 50 free scans/month
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Signal Breakdown */}
              <div className="mt-8">
                <h2 className="text-lg font-semibold mb-4">Signal Breakdown</h2>
                <SignalCards signals={result.signals} />
              </div>
            </>
          )}

          {/* Empty State */}
          {!result && !isLoading && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <svg
                  className="h-8 w-8 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">No audit yet</h3>
              <p className="text-muted-foreground mt-1">
                Enter a URL above to measure its Agent Visibility Score
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
