"use client";

import { useState } from "react";
import { ScoreGauge } from "@/components/score-gauge";
import { SignalCards } from "@/components/signal-cards";
import { UrlInput } from "@/components/url-input";

interface Signal {
  name: string;
  status: "pass" | "warn" | "fail";
  score: number;
  weight: number;
  details: string;
}

interface AuditResult {
  url: string;
  agentScore: number;
  mode: string;
  costUsd: number;
  escalated: boolean;
  signals: Signal[];
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAudit = async (url: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Call the AgentRank CLI via API route
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Audit failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto py-10 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">AgentRank.it</h1>
          <p className="text-muted-foreground mt-2">
            The PageSpeed Insights for the Agentic Web
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
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-muted-foreground">Scanning site...</p>
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
  );
}
