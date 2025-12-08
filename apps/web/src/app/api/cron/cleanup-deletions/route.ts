import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, and, lt } from "drizzle-orm";
import { credits, auditHistory, pendingDeletions } from "@/db/schema";

const MAX_RETRIES = 5;

/**
 * POST /api/cron/cleanup-deletions
 *
 * Process pending account deletions that failed during initial cleanup.
 * Should be triggered by a cron job (Vercel Cron, Cloudflare Scheduled Workers, etc.)
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
        const client = createClient({
            url: process.env.DATABASE_URL || "file:./local.db",
            authToken: process.env.DATABASE_AUTH_TOKEN,
        });
        const db = drizzle(client);

        // Get pending deletions that haven't exceeded max retries
        const pending = await db
            .select()
            .from(pendingDeletions)
            .where(
                and(
                    eq(pendingDeletions.status, "pending"),
                    lt(pendingDeletions.retryCount, MAX_RETRIES)
                )
            );

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
                await db.delete(credits).where(eq(credits.userId, deletion.userId));
                await db.delete(auditHistory).where(eq(auditHistory.userId, deletion.userId));

                // Mark as completed
                await db
                    .update(pendingDeletions)
                    .set({
                        status: "completed",
                        lastAttemptAt: new Date(),
                    })
                    .where(eq(pendingDeletions.id, deletion.id));

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
                await db
                    .update(pendingDeletions)
                    .set({
                        retryCount: newRetryCount,
                        lastError: error instanceof Error ? error.message : String(error),
                        lastAttemptAt: new Date(),
                        status: newStatus,
                    })
                    .where(eq(pendingDeletions.id, deletion.id));

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
