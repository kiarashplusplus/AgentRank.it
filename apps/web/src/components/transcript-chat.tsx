"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TranscriptEntry {
    timestamp: string;
    type: "action" | "observation" | "thought" | "error";
    message: string;
    screenshot?: string;
}

interface TranscriptChatProps {
    entries: TranscriptEntry[];
    title?: string;
}

const typeConfig = {
    action: {
        label: "Action",
        className: "bg-blue-500/10 text-blue-600",
        icon: "→",
    },
    observation: {
        label: "Observed",
        className: "bg-green-500/10 text-green-600",
        icon: "👁",
    },
    thought: {
        label: "Thinking",
        className: "bg-purple-500/10 text-purple-600",
        icon: "💭",
    },
    error: {
        label: "Error",
        className: "bg-red-500/10 text-red-600",
        icon: "⚠️",
    },
};

/**
 * Chat-style display for Think-Aloud transcript logs
 * Shows agent actions, observations, and thoughts in a conversational format
 */
export function TranscriptChat({
    entries,
    title = "Agent Transcript",
}: TranscriptChatProps) {
    if (entries.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        No transcript available for this audit.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {entries.map((entry, index) => {
                    const config = typeConfig[entry.type];
                    return (
                        <div key={index} className="flex gap-3">
                            {/* Icon */}
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">
                                {config.icon}
                            </div>

                            {/* Content */}
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                    <Badge className={config.className} variant="secondary">
                                        {config.label}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                        {entry.timestamp}
                                    </span>
                                </div>
                                <p className="text-sm">{entry.message}</p>

                                {/* Screenshot thumbnail if available */}
                                {entry.screenshot && (
                                    <div className="mt-2">
                                        <img
                                            src={entry.screenshot}
                                            alt="Screenshot at this step"
                                            className="rounded-md border max-w-xs cursor-pointer hover:opacity-80 transition-opacity"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
