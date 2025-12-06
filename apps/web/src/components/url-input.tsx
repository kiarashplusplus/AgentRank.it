"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface UrlInputProps {
    onSubmit: (url: string, mode: "quick" | "deep") => void;
    isLoading?: boolean;
}

/**
 * URL input form for triggering site audits
 * Deep mode only available for signed-in users
 */
export function UrlInput({ onSubmit, isLoading = false }: UrlInputProps) {
    const [url, setUrl] = useState("");
    const [mode, setMode] = useState<"quick" | "deep">("quick");
    const [error, setError] = useState<string | null>(null);
    const { isSignedIn } = useUser();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Basic URL validation
        let validUrl = url.trim();
        if (!validUrl) {
            setError("Please enter a URL");
            return;
        }

        // Add https:// if no protocol
        if (!validUrl.startsWith("http://") && !validUrl.startsWith("https://")) {
            validUrl = `https://${validUrl}`;
        }

        try {
            new URL(validUrl);
            onSubmit(validUrl, mode);
        } catch {
            setError("Please enter a valid URL");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex gap-2">
                <Input
                    type="text"
                    placeholder="Enter a URL to audit (e.g., stripe.com)"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1"
                    disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Scanning...
                        </>
                    ) : (
                        "Audit"
                    )}
                </Button>
            </div>

            {/* Mode Toggle */}
            <div className="flex items-center gap-4">
                <div className="flex gap-1 rounded-lg bg-muted p-1">
                    <button
                        type="button"
                        onClick={() => setMode("quick")}
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${mode === "quick"
                                ? "bg-background shadow-sm font-medium"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                        disabled={isLoading}
                    >
                        Quick
                    </button>
                    <button
                        type="button"
                        onClick={() => isSignedIn && setMode("deep")}
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${mode === "deep"
                                ? "bg-background shadow-sm font-medium"
                                : "text-muted-foreground hover:text-foreground"
                            } ${!isSignedIn ? "opacity-50 cursor-not-allowed" : ""}`}
                        disabled={isLoading || !isSignedIn}
                        title={!isSignedIn ? "Sign in for deep scans" : undefined}
                    >
                        Deep {!isSignedIn && "🔒"}
                    </button>
                </div>
                <span className="text-xs text-muted-foreground">
                    {mode === "quick" ? (
                        "~5s • $0.002 • DOM analysis"
                    ) : (
                        "~60s • $0.02 • Vision-LLM analysis"
                    )}
                </span>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
    );
}
