"use client";

import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

interface ScoreGaugeProps {
    score: number;
    label?: string;
    size?: number;
}

/**
 * Radial gauge component displaying the Agent Visibility Score (0-100)
 */
export function ScoreGauge({ score, label = "Agent Score", size = 200 }: ScoreGaugeProps) {
    // Clamp score between 0 and 100
    const clampedScore = Math.max(0, Math.min(100, score));

    // Determine color based on score
    const getColor = (score: number) => {
        if (score >= 80) return "hsl(142, 76%, 36%)"; // Green
        if (score >= 60) return "hsl(45, 93%, 47%)"; // Yellow
        if (score >= 40) return "hsl(38, 92%, 50%)"; // Orange
        return "hsl(0, 72%, 51%)"; // Red
    };

    const data = [
        {
            name: "score",
            value: clampedScore,
            fill: getColor(clampedScore),
        },
    ];

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative" style={{ width: size, height: size }}>
                <RadialBarChart
                    width={size}
                    height={size}
                    cx={size / 2}
                    cy={size / 2}
                    innerRadius={size * 0.35}
                    outerRadius={size * 0.45}
                    barSize={size * 0.1}
                    data={data}
                    startAngle={180}
                    endAngle={0}
                >
                    <PolarAngleAxis
                        type="number"
                        domain={[0, 100]}
                        angleAxisId={0}
                        tick={false}
                    />
                    <RadialBar
                        background={{ fill: "hsl(var(--muted))" }}
                        dataKey="value"
                        cornerRadius={size * 0.05}
                    />
                </RadialBarChart>
                {/* Score number in center */}
                <div
                    className="absolute inset-0 flex flex-col items-center justify-center"
                    style={{ paddingTop: size * 0.15 }}
                >
                    <span
                        className="font-bold tracking-tight"
                        style={{ fontSize: size * 0.25, color: getColor(clampedScore) }}
                    >
                        {clampedScore}
                    </span>
                    <span
                        className="text-muted-foreground"
                        style={{ fontSize: size * 0.08 }}
                    >
                        / 100
                    </span>
                </div>
            </div>
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>
    );
}
