"use client";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HistoryEntry {
    date: string;
    score: number;
    url?: string;
}

interface HistoryChartProps {
    data: HistoryEntry[];
    title?: string;
}

/**
 * Line chart showing Agent Score trends over time
 */
export function HistoryChart({
    data,
    title = "Score History",
}: HistoryChartProps) {
    if (data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        No history data available. Run more audits to see trends.
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Calculate trend
    const latestScore = data[data.length - 1]?.score || 0;
    const previousScore = data[data.length - 2]?.score || latestScore;
    const trend = latestScore - previousScore;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">{title}</CardTitle>
                {data.length > 1 && (
                    <div className="flex items-center gap-1 text-sm">
                        <span
                            className={
                                trend > 0
                                    ? "text-green-600"
                                    : trend < 0
                                        ? "text-red-600"
                                        : "text-muted-foreground"
                            }
                        >
                            {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"}
                            {Math.abs(trend)} points
                        </span>
                    </div>
                )}
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                            dataKey="date"
                            className="text-xs"
                            tick={{ fill: "hsl(var(--muted-foreground))" }}
                        />
                        <YAxis
                            domain={[0, 100]}
                            className="text-xs"
                            tick={{ fill: "hsl(var(--muted-foreground))" }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                            }}
                            labelStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Line
                            type="monotone"
                            dataKey="score"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                            activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
