"use client";

import { useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";

/**
 * Account settings page with account deletion functionality
 */
export default function AccountPage() {
    const { user, isLoaded } = useUser();
    const { signOut } = useClerk();
    const router = useRouter();

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    if (!user) {
        router.push("/");
        return null;
    }

    const handleDeleteAccount = async () => {
        if (confirmText !== "DELETE") return;

        setIsDeleting(true);
        setError(null);

        try {
            const response = await fetch("/api/account/delete", {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = (await response.json()) as { error?: string };
                throw new Error(data.error || "Failed to delete account");
            }

            // Sign out and redirect to home
            await signOut();
            router.push("/");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete account");
            setIsDeleting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="container mx-auto px-4 py-8 max-w-2xl">
                <h1 className="text-3xl font-bold mb-2">Account Settings</h1>
                <p className="text-muted-foreground mb-8">
                    Manage your account settings and data
                </p>

                {/* User Info */}
                <section className="border rounded-lg p-6 mb-8">
                    <h2 className="text-lg font-semibold mb-4">Account Information</h2>
                    <div className="space-y-3">
                        <div>
                            <span className="text-sm text-muted-foreground">Email</span>
                            <p className="font-medium">{user.primaryEmailAddress?.emailAddress || "No email"}</p>
                        </div>
                        <div>
                            <span className="text-sm text-muted-foreground">Member since</span>
                            <p className="font-medium">
                                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown"}
                            </p>
                        </div>
                    </div>
                </section>

                {/* Danger Zone */}
                <section className="border border-red-200 dark:border-red-900 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
                        Danger Zone
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">
                        Once you delete your account, there is no going back. All your data will be permanently removed.
                    </p>

                    <button
                        onClick={() => setShowDeleteDialog(true)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                        Delete Account
                    </button>
                </section>

                {/* Delete Confirmation Dialog */}
                {showDeleteDialog && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-background border rounded-lg p-6 max-w-md w-full shadow-xl">
                            <h3 className="text-xl font-semibold mb-2">Delete Account</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                This action cannot be undone. This will permanently delete your account and remove all associated data:
                            </p>
                            <ul className="text-sm text-muted-foreground mb-4 list-disc list-inside space-y-1">
                                <li>Your scan credits and settings</li>
                                <li>All audit history and results</li>
                                <li>Your AgentRank account</li>
                            </ul>

                            <p className="text-sm font-medium mb-2">
                                Type <span className="font-mono bg-muted px-1 rounded">DELETE</span> to confirm:
                            </p>
                            <input
                                type="text"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder="Type DELETE"
                                className="w-full px-3 py-2 border rounded-md bg-background mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
                                disabled={isDeleting}
                            />

                            {error && (
                                <p className="text-sm text-red-600 mb-4">{error}</p>
                            )}

                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => {
                                        setShowDeleteDialog(false);
                                        setConfirmText("");
                                        setError(null);
                                    }}
                                    disabled={isDeleting}
                                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteAccount}
                                    disabled={confirmText !== "DELETE" || isDeleting}
                                    className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                                >
                                    {isDeleting ? "Deleting..." : "Delete Account"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
