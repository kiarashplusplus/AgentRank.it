import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";

/**
 * DELETE /api/history/all
 * Delete all audit history entries for the authenticated user
 */
export async function DELETE() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        await db.deleteAllAuditHistory(userId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete all history:", error);
        return NextResponse.json(
            { error: "Failed to delete history" },
            { status: 500 }
        );
    }
}
