import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";

/**
 * GET /api/history
 * Fetch all audit history entries for the authenticated user
 */
export async function GET() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        const entries = await db.getAuditHistory(userId);

        return NextResponse.json({ entries });
    } catch (error) {
        console.error("Failed to fetch history:", error);
        return NextResponse.json(
            { error: "Failed to fetch history" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/history?id=<id>
 * Delete a single audit history entry by ID (verifies ownership)
 */
export async function DELETE(request: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        const id = request.nextUrl.searchParams.get("id");
        if (!id) {
            return NextResponse.json(
                { error: "Entry ID required" },
                { status: 400 }
            );
        }

        await db.deleteAuditHistoryEntry(parseInt(id, 10), userId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete entry:", error);
        return NextResponse.json(
            { error: "Failed to delete entry" },
            { status: 500 }
        );
    }
}
