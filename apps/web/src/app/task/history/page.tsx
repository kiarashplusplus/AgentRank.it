"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import {
    Trash2,
    ExternalLink,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Zap,
    Clock,
    ArrowLeft,
    CheckCircle2,
    XCircle,
} from "lucide-react";

interface TaskHistoryEntry {
    id: number;
    url: string;
    goal: string;
    timeoutSeconds: number;
    success: boolean;
    output: string | null;
    error: string | null;
    steps: number | null;
    durationMs: number | null;
    videoUrl: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    transcript: string[] | null;
    createdAt: string;
}

function formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
}

function formatTokens(tokens: number): string {
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
    return tokens.toString();
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function TaskHistoryPage() {
    const { user, isLoaded } = useUser();
    const router = useRouter();

    const [entries, setEntries] = useState<TaskHistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
    const [isDeletingAll, setIsDeletingAll] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const fetchHistory = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await fetch("/api/task/history");
            if (!response.ok) {
                throw new Error("Failed to fetch history");
            }
            const data = (await response.json()) as { entries: TaskHistoryEntry[] };
            setEntries(data.entries || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load history");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isLoaded && user) {
            fetchHistory();
        }
    }, [isLoaded, user, fetchHistory]);

    // Redirect if not authenticated
    useEffect(() => {
        if (isLoaded && !user) {
            router.push("/task");
        }
    }, [isLoaded, user, router]);

    const handleDelete = async (id: number) => {
        setDeletingId(id);
        try {
            const response = await fetch(`/api/task/history?id=${id}`, {
                method: "DELETE",
            });
            if (!response.ok) {
                throw new Error("Failed to delete entry");
            }
            setEntries((prev) => prev.filter((entry) => entry.id !== id));
            if (expandedId === id) setExpandedId(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete");
        } finally {
            setDeletingId(null);
        }
    };

    const handleDeleteAll = async () => {
        setIsDeletingAll(true);
        try {
            const response = await fetch("/api/task/history/all", {
                method: "DELETE",
            });
            if (!response.ok) {
                throw new Error("Failed to delete all history");
            }
            setEntries([]);
            setShowDeleteAllDialog(false);
            setExpandedId(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete all");
        } finally {
            setIsDeletingAll(false);
        }
    };

    const toggleExpand = (id: number) => {
        setExpandedId(expandedId === id ? null : id);
    };

    if (!isLoaded) {
        return (
            <div className="min-h-screen bg-background">
                <Header />
                <main className="container mx-auto px-4 py-8">
                    <div className="animate-pulse">
                        <div className="h-8 w-48 bg-muted rounded mb-4"></div>
                        <div className="h-4 w-96 bg-muted rounded"></div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="container mx-auto px-4 py-8 max-w-4xl">
                {/* Page Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Link
                                href="/task"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                            <h1 className="text-3xl font-bold">Task History</h1>
                        </div>
                        <p className="text-muted-foreground">
                            View and manage your past browser automation tasks
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchHistory}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border rounded-md hover:bg-muted"
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                            Refresh
                        </button>
                        {entries.length > 0 && (
                            <button
                                onClick={() => setShowDeleteAllDialog(true)}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors border border-red-200 dark:border-red-900 rounded-md hover:bg-red-50 dark:hover:bg-red-950"
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete All
                            </button>
                        )}
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="p-4 mb-6 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg text-red-600 dark:text-red-400">
                        {error}
                    </div>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="p-4 border rounded-lg animate-pulse">
                                <div className="h-5 w-64 bg-muted rounded mb-2"></div>
                                <div className="h-4 w-32 bg-muted rounded"></div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && entries.length === 0 && (
                    <div className="text-center py-16 border rounded-lg">
                        <div className="text-4xl mb-4">🤖</div>
                        <h3 className="text-lg font-semibold mb-2">No task history yet</h3>
                        <p className="text-muted-foreground mb-4">
                            Run your first browser task to see it here
                        </p>
                        <Link
                            href="/task"
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors inline-block"
                        >
                            Run a Task
                        </Link>
                    </div>
                )}

                {/* History List */}
                {!isLoading && entries.length > 0 && (
                    <div className="space-y-3">
                        {entries.map((entry) => {
                            const isExpanded = expandedId === entry.id;
                            const totalTokens = (entry.inputTokens || 0) + (entry.outputTokens || 0);

                            return (
                                <div key={entry.id} className="border rounded-lg overflow-hidden">
                                    {/* Main Row */}
                                    <div
                                        className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                                        onClick={() => toggleExpand(entry.id)}
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-2">
                                                    {/* Status Icon */}
                                                    {entry.success ? (
                                                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                                                    ) : (
                                                        <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                                                    )}

                                                    {/* URL */}
                                                    <a
                                                        href={entry.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-foreground font-medium truncate hover:underline flex items-center gap-1"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {entry.url}
                                                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                                    </a>
                                                </div>

                                                <p className="text-sm text-muted-foreground truncate mb-2">
                                                    {entry.goal}
                                                </p>

                                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {entry.durationMs ? formatTime(entry.durationMs) : "-"}
                                                    </span>
                                                    <span>{entry.steps ?? 0} steps</span>
                                                    {totalTokens > 0 && (
                                                        <span className="flex items-center gap-1">
                                                            <Zap className="h-3 w-3" />
                                                            {formatTokens(totalTokens)} tokens
                                                        </span>
                                                    )}
                                                    <span>{formatDate(entry.createdAt)}</span>
                                                </div>
                                            </div>

                                            {/* Expand/Collapse Icon */}
                                            <div className="p-2 text-muted-foreground">
                                                {isExpanded ? (
                                                    <ChevronUp className="h-4 w-4" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4" />
                                                )}
                                            </div>

                                            {/* Delete Button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(entry.id);
                                                }}
                                                disabled={deletingId === entry.id}
                                                className="p-2 text-muted-foreground hover:text-red-600 transition-colors rounded-md hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"
                                                title="Delete this entry"
                                            >
                                                {deletingId === entry.id ? (
                                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="border-t bg-muted/30 p-4 space-y-4">
                                            {/* Token Usage */}
                                            {totalTokens > 0 && (
                                                <div className="flex gap-4 p-3 rounded-lg bg-background border">
                                                    <div className="flex items-center gap-2">
                                                        <Zap className="h-4 w-4 text-yellow-500" />
                                                        <span className="text-sm font-medium">Token Usage:</span>
                                                    </div>
                                                    <div className="flex gap-4 text-sm">
                                                        <span>
                                                            <span className="text-muted-foreground">In:</span>{" "}
                                                            <span className="font-mono">
                                                                {formatTokens(entry.inputTokens || 0)}
                                                            </span>
                                                        </span>
                                                        <span>
                                                            <span className="text-muted-foreground">Out:</span>{" "}
                                                            <span className="font-mono">
                                                                {formatTokens(entry.outputTokens || 0)}
                                                            </span>
                                                        </span>
                                                        <span>
                                                            <span className="text-muted-foreground">Total:</span>{" "}
                                                            <span className="font-mono font-medium">
                                                                {formatTokens(totalTokens)}
                                                            </span>
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Output */}
                                            {entry.output && (
                                                <div>
                                                    <h4 className="text-sm font-medium mb-2">Result</h4>
                                                    <p className="text-sm text-muted-foreground bg-background border rounded-lg p-3">
                                                        {entry.output}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Error */}
                                            {entry.error && (
                                                <div>
                                                    <h4 className="text-sm font-medium mb-2 text-red-600">Error</h4>
                                                    <p className="text-sm text-red-600/80 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg p-3">
                                                        {entry.error}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Transcript */}
                                            {entry.transcript && entry.transcript.length > 0 && (
                                                <div>
                                                    <h4 className="text-sm font-medium mb-2">
                                                        Transcript ({entry.transcript.length} steps)
                                                    </h4>
                                                    <div className="space-y-2 max-h-48 overflow-y-auto bg-background border rounded-lg p-3">
                                                        {entry.transcript.map((step, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="p-2 rounded bg-muted/50 text-xs font-mono text-muted-foreground"
                                                            >
                                                                <span className="text-primary mr-2">[{idx + 1}]</span>
                                                                {step.length > 200 ? step.slice(0, 200) + "..." : step}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Video */}
                                            {entry.videoUrl && (
                                                <div>
                                                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                                        <span>🎥</span> Agent Replay
                                                    </h4>
                                                    <div className="rounded-lg overflow-hidden border bg-black">
                                                        <video
                                                            src={entry.videoUrl}
                                                            controls
                                                            className="w-full"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Metadata */}
                                            <div className="text-xs text-muted-foreground pt-2 border-t">
                                                Timeout: {entry.timeoutSeconds}s • Created: {formatDate(entry.createdAt)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Delete All Confirmation Dialog */}
                {showDeleteAllDialog && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-background border rounded-lg p-6 max-w-md w-full shadow-xl">
                            <h3 className="text-xl font-semibold mb-2">Delete All History</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Are you sure you want to delete all {entries.length} task history entries?
                                This action cannot be undone.
                            </p>

                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowDeleteAllDialog(false)}
                                    disabled={isDeletingAll}
                                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteAll}
                                    disabled={isDeletingAll}
                                    className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                                >
                                    {isDeletingAll ? "Deleting..." : "Delete All"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
