import { ScoreGauge } from "@/components/score-gauge";
import { SignalCards } from "@/components/signal-cards";

// Mock data for demonstration
const mockResult = {
  agentScore: 72,
  signals: [
    {
      name: "permissions",
      status: "pass" as const,
      score: 100,
      weight: 20,
      details: "robots.txt allows GPTBot and ClaudeBot",
    },
    {
      name: "structure",
      status: "warn" as const,
      score: 65,
      weight: 25,
      details: "Moderate semantic density, some div soup detected",
    },
    {
      name: "accessibility",
      status: "pass" as const,
      score: 85,
      weight: 25,
      details: "Good ARIA labels, proper heading hierarchy",
    },
    {
      name: "hydration",
      status: "pass" as const,
      score: 90,
      weight: 15,
      details: "Time to Interactive: 1.2s",
    },
    {
      name: "hostility",
      status: "fail" as const,
      score: 0,
      weight: 15,
      details: "Cloudflare Turnstile detected",
    },
  ],
};

export default function Home() {
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

        {/* Score Section */}
        <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
          {/* Main Gauge */}
          <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-6">
            <ScoreGauge score={mockResult.agentScore} size={220} />
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Your site is{" "}
              <span className="font-medium text-foreground">
                {mockResult.agentScore >= 80
                  ? "Agent Ready"
                  : mockResult.agentScore >= 60
                    ? "Partially Agent Ready"
                    : "Not Agent Ready"}
              </span>
            </p>
          </div>

          {/* URL Input & Quick Info */}
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">Audit Result</h2>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">URL</span>
                  <span className="font-mono">https://example.com</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mode</span>
                  <span>Quick Scan</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost</span>
                  <span>$0.002</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Escalated</span>
                  <span>No</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Signal Breakdown */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Signal Breakdown</h2>
          <SignalCards signals={mockResult.signals} />
        </div>
      </div>
    </main>
  );
}
