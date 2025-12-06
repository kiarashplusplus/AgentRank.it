import { eq } from "drizzle-orm";
import type { Database } from "@/db";
import { credits } from "@/db/schema";

export type ScanType = "quick" | "deep";

export interface CreditCheckResult {
    allowed: boolean;
    remaining: number;
    tier: string;
    resetAt: Date | null;
}

/**
 * Check if a user has credits for a scan
 */
export async function checkCredits(
    db: Database,
    userId: string,
    scanType: ScanType
): Promise<CreditCheckResult> {
    const [credit] = await db
        .select()
        .from(credits)
        .where(eq(credits.userId, userId))
        .limit(1);

    // Create default credits for new users
    if (!credit) {
        await db.insert(credits).values({
            userId,
            quickRemaining: 50,
            deepRemaining: 5,
            tier: "free",
            resetAt: getNextMonthReset(),
        });

        return {
            allowed: true,
            remaining: scanType === "quick" ? 50 : 5,
            tier: "free",
            resetAt: getNextMonthReset(),
        };
    }

    // Check if reset is needed
    if (credit.resetAt && new Date() > credit.resetAt) {
        const newLimits =
            credit.tier === "premium"
                ? { quick: 500, deep: 100 }
                : { quick: 50, deep: 5 };

        await db
            .update(credits)
            .set({
                quickRemaining: newLimits.quick,
                deepRemaining: newLimits.deep,
                resetAt: getNextMonthReset(),
                updatedAt: new Date(),
            })
            .where(eq(credits.userId, userId));

        return {
            allowed: true,
            remaining: scanType === "quick" ? newLimits.quick : newLimits.deep,
            tier: credit.tier,
            resetAt: getNextMonthReset(),
        };
    }

    const remaining =
        scanType === "quick" ? credit.quickRemaining : credit.deepRemaining;

    return {
        allowed: remaining > 0,
        remaining,
        tier: credit.tier,
        resetAt: credit.resetAt,
    };
}

/**
 * Deduct a credit after successful scan
 */
export async function deductCredit(
    db: Database,
    userId: string,
    scanType: ScanType
): Promise<void> {
    const [credit] = await db
        .select()
        .from(credits)
        .where(eq(credits.userId, userId))
        .limit(1);

    if (!credit) {
        throw new Error("Credit record not found");
    }

    const updates =
        scanType === "quick"
            ? { quickRemaining: Math.max(0, credit.quickRemaining - 1) }
            : { deepRemaining: Math.max(0, credit.deepRemaining - 1) };

    await db
        .update(credits)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(credits.userId, userId));
}

/**
 * Get the next monthly reset date (1st of next month)
 */
function getNextMonthReset(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}
