"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Trash2, ExternalLink, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

interface SignalResult {
    score: number;
    status: string;
    details: string;
    weight?: number;
    recommendations?: string[];
}

interface HistoryEntry {
    id: number;
    url: string;
    agentScore: number;
    mode: string;
    escalated: boolean;
    costUsd: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
    resultJson: string | null;
    createdAt: string;
}

/**
 * Get score color based on value
 */
function getScoreColor(score: number): string {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
}

/**
 * Get score badge style
 */
function getScoreBadge(score: number): string {
    if (score >= 80) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (score >= 60) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    if (score >= 40) return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
}

/**
 * Get status color
 */
function getStatusColor(status: string): string {
    if (status === "pass") return "text-green-600 dark:text-green-400";
    if (status === "warn") return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
}

/**
 * Signal name display mapping
 */
function getSignalDisplayName(signal: string): string {
    const names: Record<string, string> = {
        permissions: "🔐 Permissions",
        structure: "🏗️ Structure",
        accessibility: "♿ Accessibility",
        hydration: "⚡ Hydration",
        hostility: "🛡️ Hostility",
    };
    return names[signal] || signal;
}

/**
 * Audit History Page - displays user's past scans with deletion options
 */
export default function HistoryPage() {
    const { user, isLoaded } = useUser();
    const router = useRouter();

    const [entries, setEntries] = useState<HistoryEntry[]>([]);
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
            const response = await fetch("/api/history");
            if (!response.ok) {
                throw new Error("Failed to fetch history");
            }
            const data = (await response.json()) as { entries: HistoryEntry[] };
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
            router.push("/");
        }
    }, [isLoaded, user, router]);

    const handleDelete = async (id: number) => {
        setDeletingId(id);
        try {
            const response = await fetch(`/api/history?id=${id}`, {
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
            const response = await fetch("/api/history/all", {
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

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const parseResultJson = (resultJson: string | null): Record<string, SignalResult> | null => {
        if (!resultJson) return null;
        try {
            const parsed = JSON.parse(resultJson);
            return parsed.signals || null;
        } catch {
            return null;
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
                        <h1 className="text-3xl font-bold mb-2">Audit History</h1>
                        <p className="text-muted-foreground">
                            View and manage your past scan results
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
                        <div className="text-4xl mb-4">📊</div>
                        <h3 className="text-lg font-semibold mb-2">No audit history yet</h3>
                        <p className="text-muted-foreground mb-4">
                            Run your first scan to see results here
                        </p>
                        <button
                            onClick={() => router.push("/")}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                        >
                            Run a Scan
                        </button>
                    </div>
                )}

                {/* History List */}
                {!isLoading && entries.length > 0 && (
                    <div className="space-y-3">
                        {entries.map((entry) => {
                            const signals = parseResultJson(entry.resultJson);
                            const isExpanded = expandedId === entry.id;

                            return (
                                <div
                                    key={entry.id}
                                    className="border rounded-lg overflow-hidden"
                                >
                                    {/* Main Row */}
                                    <div
                                        className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                                        onClick={() => toggleExpand(entry.id)}
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-2">
                                                    {/* Score Badge */}
                                                    <span
                                                        className={`px-2.5 py-0.5 rounded-full text-sm font-medium ${getScoreBadge(entry.agentScore)}`}
                                                    >
                                                        {entry.agentScore}
                                                    </span>

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

                                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                    <span className="capitalize">{entry.mode} scan</span>
                                                    <span>{formatDate(entry.createdAt)}</span>
                                                    {entry.inputTokens !== null && entry.inputTokens > 0 && (
                                                        <span className="text-xs">
                                                            {entry.inputTokens.toLocaleString()} in / {entry.outputTokens?.toLocaleString() || 0} out tokens
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Score Bar */}
                                            <div className="hidden sm:flex items-center gap-2 w-24">
                                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${getScoreColor(entry.agentScore)} transition-all`}
                                                        style={{ width: `${entry.agentScore}%` }}
                                                    />
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
                                    {isExpanded && signals && (() => {
                                        // Collect all recommendations across categories
                                        const allRecommendations: Array<{ signal: string; recommendation: string }> = [];
                                        Object.entries(signals).forEach(([signalName, signal]) => {
                                            if (signal.recommendations) {
                                                signal.recommendations.forEach((rec) => {
                                                    allRecommendations.push({
                                                        signal: signalName,
                                                        recommendation: rec,
                                                    });
                                                });
                                            }
                                        });

                                        return (
                                            <div className="border-t bg-muted/30 p-4 space-y-6">
                                                {/* Signal Details Table */}
                                                <div>
                                                    <h4 className="text-sm font-semibold mb-3">Signal Breakdown</h4>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead>
                                                                <tr className="border-b">
                                                                    <th className="text-left py-2 pr-4 font-medium">Category</th>
                                                                    <th className="text-center py-2 px-2 font-medium">Status</th>
                                                                    <th className="text-center py-2 px-2 font-medium">Score</th>
                                                                    <th className="text-center py-2 px-2 font-medium">Weight</th>
                                                                    <th className="text-left py-2 pl-4 font-medium hidden sm:table-cell">Details</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {Object.entries(signals).map(([signalName, signal]) => (
                                                                    <tr key={signalName} className="border-b last:border-0">
                                                                        <td className="py-3 pr-4">
                                                                            <span className="font-medium">
                                                                                {getSignalDisplayName(signalName)}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-3 px-2 text-center">
                                                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${signal.status === "pass"
                                                                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                                                                    : signal.status === "warn"
                                                                                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                                                                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                                                                }`}>
                                                                                {signal.status.toUpperCase()}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-3 px-2 text-center">
                                                                            <div className="flex items-center justify-center gap-2">
                                                                                <span className={`font-medium ${getStatusColor(signal.status)}`}>
                                                                                    {signal.score}
                                                                                </span>
                                                                                <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                                    <div
                                                                                        className={`h-full ${getScoreColor(signal.score)}`}
                                                                                        style={{ width: `${signal.score}%` }}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-3 px-2 text-center text-muted-foreground">
                                                                            {signal.weight !== undefined ? `${signal.weight}%` : "-"}
                                                                        </td>
                                                                        <td className="py-3 pl-4 hidden sm:table-cell">
                                                                            <p className="text-muted-foreground text-xs line-clamp-2">
                                                                                {signal.details || "No details available"}
                                                                            </p>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>

                                                {/* Mobile Details (shown below table on mobile) */}
                                                <div className="sm:hidden space-y-3">
                                                    {Object.entries(signals).map(([signalName, signal]) => (
                                                        signal.details && (
                                                            <div key={signalName} className="p-3 bg-background rounded-lg border">
                                                                <span className="font-medium text-xs text-muted-foreground">
                                                                    {getSignalDisplayName(signalName)}
                                                                </span>
                                                                <p className="text-sm mt-1">{signal.details}</p>
                                                            </div>
                                                        )
                                                    ))}
                                                </div>

                                                {/* Per-Category Recommendations */}
                                                {Object.entries(signals).some(([, signal]) => signal.recommendations && signal.recommendations.length > 0) && (
                                                    <div>
                                                        <h4 className="text-sm font-semibold mb-3">Category Recommendations</h4>
                                                        <div className="grid gap-3 sm:grid-cols-2">
                                                            {Object.entries(signals).map(([signalName, signal]) => (
                                                                signal.recommendations && signal.recommendations.length > 0 && (
                                                                    <div key={signalName} className="p-3 bg-background rounded-lg border">
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            <span className="font-medium text-sm">
                                                                                {getSignalDisplayName(signalName)}
                                                                            </span>
                                                                        </div>
                                                                        <ul className="space-y-1">
                                                                            {signal.recommendations.map((rec, idx) => (
                                                                                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                                                                                    <span className="text-primary mt-0.5">→</span>
                                                                                    <span>{rec}</span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Aggregated Recommendations */}
                                                {allRecommendations.length > 0 && (
                                                    <div className="border-t pt-4">
                                                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                                            <span>📋</span>
                                                            All Recommendations ({allRecommendations.length})
                                                        </h4>
                                                        <div className="bg-background rounded-lg border p-4">
                                                            <ul className="space-y-2">
                                                                {allRecommendations.map((item, idx) => (
                                                                    <li key={idx} className="flex items-start gap-3 text-sm">
                                                                        <span className={`text-xs px-1.5 py-0.5 rounded ${item.signal === "permissions" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                                                                                item.signal === "structure" ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" :
                                                                                    item.signal === "accessibility" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                                                                                        item.signal === "hydration" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                                                                                            "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                                                            }`}>
                                                                            {item.signal.slice(0, 4).toUpperCase()}
                                                                        </span>
                                                                        <span className="text-muted-foreground">{item.recommendation}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Expanded but no signals */}
                                    {isExpanded && !signals && (
                                        <div className="border-t bg-muted/30 p-4">
                                            <p className="text-sm text-muted-foreground">
                                                No detailed signal data available for this scan.
                                            </p>
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
                                Are you sure you want to delete all {entries.length} audit history entries?
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
