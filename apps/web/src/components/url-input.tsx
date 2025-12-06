"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface UrlInputProps {
    onSubmit: (url: string) => void;
    isLoading?: boolean;
}

/**
 * URL input form for triggering site audits
 */
export function UrlInput({ onSubmit, isLoading = false }: UrlInputProps) {
    const [url, setUrl] = useState("");
    const [error, setError] = useState<string | null>(null);

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
            onSubmit(validUrl);
        } catch {
            setError("Please enter a valid URL");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
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
            {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
    );
}
