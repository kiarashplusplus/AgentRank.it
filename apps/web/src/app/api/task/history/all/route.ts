import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";

/**
 * DELETE /api/task/history/all
 * Delete all task history entries for the authenticated user
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

        await db.deleteAllTaskHistory(userId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete all task history:", error);
        return NextResponse.json(
            { error: "Failed to delete all history" },
            { status: 500 }
        );
    }
}
