import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { credits, auditHistory } from "@/db/schema";

/**
 * DELETE /api/account/delete
 *
 * Permanently deletes the authenticated user's account and all associated data:
 * - Credits and settings from D1 database
 * - Audit history from D1 database
 * - User account from Clerk
 *
 * Requires authentication.
 */
export async function DELETE() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Delete user from Clerk FIRST
        // This ensures that if Clerk deletion fails, user data remains intact
        // If we deleted DB data first and Clerk failed, user would exist but have no data
        const clerk = await clerkClient();
        await clerk.users.deleteUser(userId);

        // Now clean up database records
        // If this fails, queue for retry via cron job
        try {
            const client = createClient({
                url: process.env.DATABASE_URL || "file:./local.db",
                authToken: process.env.DATABASE_AUTH_TOKEN,
            });
            const db = drizzle(client);

            // Delete user's credits
            await db.delete(credits).where(eq(credits.userId, userId));

            // Delete user's audit history
            await db.delete(auditHistory).where(eq(auditHistory.userId, userId));
        } catch (dbError) {
            // Log and queue for retry - account is already deleted from Clerk
            console.error("Failed to clean up user data from database:", dbError);

            // Try to insert into pending deletions for later cleanup
            try {
                const client = createClient({
                    url: process.env.DATABASE_URL || "file:./local.db",
                    authToken: process.env.DATABASE_AUTH_TOKEN,
                });
                const db = drizzle(client);
                const { pendingDeletions } = await import("@/db/schema");

                await db.insert(pendingDeletions).values({
                    userId,
                    lastError: dbError instanceof Error ? dbError.message : String(dbError),
                });
            } catch (queueError) {
                // If we can't even queue, log it - manual intervention required
                console.error("CRITICAL: Failed to queue pending deletion:", queueError);
            }
        }

        return NextResponse.json({
            success: true,
            message: "Account and all associated data have been permanently deleted.",
        });
    } catch (error) {
        console.error("Account deletion error:", error);

        if (error instanceof Error) {
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: "Failed to delete account" },
            { status: 500 }
        );
    }
}
