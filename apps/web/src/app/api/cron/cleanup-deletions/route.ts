import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";

const MAX_RETRIES = 5;

/**
 * POST /api/cron/cleanup-deletions
 *
 * Process pending account deletions that failed during initial cleanup.
 * Should be triggered by a cron job (GitHub Actions, Cloudflare Scheduled Workers, etc.)
 *
 * Requires CRON_SECRET header for authentication.
 */
export async function POST(request: NextRequest) {
    // Verify cron secret
    const cronSecret = request.headers.get("x-cron-secret");
    if (cronSecret !== process.env.CRON_SECRET) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        // Get pending deletions that haven't exceeded max retries
        const pending = await db.getPendingDeletions();

        const results = {
            processed: 0,
            succeeded: 0,
            failed: 0,
            markedFailed: 0,
        };

        for (const deletion of pending) {
            results.processed++;

            try {
                // Attempt to delete user data
                await db.deleteUserCredits(deletion.userId);
                await db.deleteAllAuditHistory(deletion.userId);

                // Mark as completed
                await db.updatePendingDeletion(deletion.id, {
                    status: "completed",
                });

                results.succeeded++;
            } catch (error) {
                const newRetryCount = deletion.retryCount + 1;
                const newStatus = newRetryCount >= MAX_RETRIES ? "failed" : "pending";

                if (newStatus === "failed") {
                    results.markedFailed++;
                } else {
                    results.failed++;
                }

                // Update with error and increment retry count
                await db.updatePendingDeletion(deletion.id, {
                    retryCount: newRetryCount,
                    lastError: error instanceof Error ? error.message : String(error),
                    status: newStatus,
                });

                console.error(`Failed to cleanup deletion ${deletion.id}:`, error);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${results.processed} pending deletions`,
            results,
        });
    } catch (error) {
        console.error("Cleanup deletions error:", error);

        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to process deletions" },
            { status: 500 }
        );
    }
}
