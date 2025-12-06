import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url || typeof url !== "string") {
            return NextResponse.json(
                { error: "URL is required" },
                { status: 400 }
            );
        }

        // Path to the AgentRank CLI (relative to monorepo root)
        const cliPath = path.resolve(process.cwd(), "../../dist/cli/index.js");

        // Run the audit command
        const { stdout, stderr } = await execAsync(
            `node "${cliPath}" audit "${url}" --json`,
            {
                timeout: 60000, // 60 second timeout
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
            mode: result.meta?.scanMode || "quick",
            costUsd: result.meta?.costUsd || 0.002,
            escalated: result.escalation?.triggered || false,
            signals: Object.entries(result.signals || {}).map(([name, signal]: [string, unknown]) => {
                const s = signal as { status: string; score: number; weight: number; details: string };
                return {
                    name,
                    status: s.status as "pass" | "warn" | "fail",
                    score: s.score || 0,
                    weight: s.weight || 0,
                    details: s.details || "",
                };
            }),
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
