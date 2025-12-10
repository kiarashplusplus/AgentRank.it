import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * Cloudflare D1 HTTP API Client
 * 
 * Direct REST API access to D1 from any environment.
 * Uses the Cloudflare API v4 endpoint for D1 queries.
 */
class D1HttpClient {
    private accountId: string;
    private databaseId: string;
    private token: string;

    constructor() {
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
        const token = process.env.CLOUDFLARE_API_TOKEN;

        if (!accountId || !databaseId || !token) {
            throw new Error(
                "Missing Cloudflare D1 credentials. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, and CLOUDFLARE_API_TOKEN."
            );
        }

        this.accountId = accountId;
        this.databaseId = databaseId;
        this.token = token;
    }

    private get baseUrl(): string {
        return `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}`;
    }

    async query<T = unknown>(sql: string, params: unknown[] = []): Promise<{ results: T[]; meta: { changes: number; last_row_id: number; duration: number } }> {
        const response = await fetch(`${this.baseUrl}/query`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ sql, params }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`D1 query failed: ${response.status} ${error}`);
        }

        const data = await response.json() as {
            success: boolean;
            errors: Array<{ message: string }>;
            result: Array<{ results: T[]; meta: { changes: number; last_row_id: number; duration: number } }>;
        };

        if (!data.success) {
            throw new Error(`D1 query error: ${data.errors.map((e: { message: string }) => e.message).join(", ")}`);
        }

        return data.result[0];
    }

    async execute(sql: string, params: unknown[] = []): Promise<{ changes: number; lastRowId: number }> {
        const result = await this.query(sql, params);
        return {
            changes: result.meta.changes,
            lastRowId: result.meta.last_row_id,
        };
    }
}

/**
 * Database operations using Cloudflare D1 HTTP API
 */
export const db = {
    /**
     * Insert a record into the audit_history table
     */
    async insertAuditHistory(values: {
        userId: string;
        url: string;
        agentScore: number;
        mode: string;
        escalated: boolean;
        costUsd?: number | null;
        inputTokens?: number | null;
        outputTokens?: number | null;
        resultJson?: string | null;
    }): Promise<void> {
        const client = new D1HttpClient();
        await client.query(
            `INSERT INTO audit_history (user_id, url, agent_score, mode, escalated, cost_usd, input_tokens, output_tokens, result_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                values.userId,
                values.url,
                values.agentScore,
                values.mode,
                values.escalated ? 1 : 0,
                values.costUsd ?? null,
                values.inputTokens ?? null,
                values.outputTokens ?? null,
                values.resultJson ?? null,
                Math.floor(Date.now() / 1000), // Unix timestamp
            ]
        );
    },

    /**
     * Get all audit history entries for a user
     */
    async getAuditHistory(userId: string): Promise<Array<{
        id: number;
        url: string;
        agentScore: number;
        mode: string;
        escalated: boolean;
        costUsd: number | null;
        inputTokens: number | null;
        outputTokens: number | null;
        resultJson: string | null;
        createdAt: string;
    }>> {
        const client = new D1HttpClient();
        const result = await client.query<{
            id: number;
            url: string;
            agent_score: number;
            mode: string;
            escalated: number;
            cost_usd: number | null;
            input_tokens: number | null;
            output_tokens: number | null;
            result_json: string | null;
            created_at: number;
        }>(
            `SELECT * FROM audit_history WHERE user_id = ? ORDER BY created_at DESC`,
            [userId]
        );

        return result.results.map(row => ({
            id: row.id,
            url: row.url,
            agentScore: row.agent_score,
            mode: row.mode,
            escalated: row.escalated === 1,
            costUsd: row.cost_usd,
            inputTokens: row.input_tokens,
            outputTokens: row.output_tokens,
            resultJson: row.result_json,
            createdAt: new Date(row.created_at * 1000).toISOString(),
        }));
    },

    /**
     * Delete a single audit history entry
     */
    async deleteAuditHistoryEntry(id: number, userId: string): Promise<void> {
        const client = new D1HttpClient();
        await client.query(
            `DELETE FROM audit_history WHERE id = ? AND user_id = ?`,
            [id, userId]
        );
    },

    /**
     * Delete all audit history entries for a user
     */
    async deleteAllAuditHistory(userId: string): Promise<void> {
        const client = new D1HttpClient();
        await client.query(
            `DELETE FROM audit_history WHERE user_id = ?`,
            [userId]
        );
    },

    /**
     * Delete all user credits
     */
    async deleteUserCredits(userId: string): Promise<void> {
        const client = new D1HttpClient();
        await client.query(
            `DELETE FROM credits WHERE user_id = ?`,
            [userId]
        );
    },

    /**
     * Check if a user has credits for a scan
     */
    async checkCredits(userId: string, scanType: "quick" | "deep"): Promise<{
        allowed: boolean;
        remaining: number;
        tier: string;
        resetAt: Date | null;
    }> {
        const client = new D1HttpClient();
        const result = await client.query<{
            user_id: string;
            quick_remaining: number;
            deep_remaining: number;
            tier: string;
            reset_at: number | null;
        }>(
            `SELECT * FROM credits WHERE user_id = ? LIMIT 1`,
            [userId]
        );

        // Helper to get next month reset date (1st of next month)
        const getNextMonthReset = (): Date => {
            const now = new Date();
            return new Date(now.getFullYear(), now.getMonth() + 1, 1);
        };

        // Create default credits for new users
        if (result.results.length === 0) {
            const resetAt = getNextMonthReset();
            await client.query(
                `INSERT INTO credits (user_id, quick_remaining, deep_remaining, tier, reset_at, created_at, updated_at)
                 VALUES (?, 50, 5, 'free', ?, ?, ?)`,
                [userId, Math.floor(resetAt.getTime() / 1000), Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
            );

            return {
                allowed: true,
                remaining: scanType === "quick" ? 50 : 5,
                tier: "free",
                resetAt: resetAt,
            };
        }

        const credit = result.results[0];
        const resetAt = credit.reset_at ? new Date(credit.reset_at * 1000) : null;

        // Check if reset is needed
        if (resetAt && new Date() > resetAt) {
            const newLimits = credit.tier === "premium"
                ? { quick: 500, deep: 100 }
                : { quick: 50, deep: 5 };

            const newResetAt = getNextMonthReset();
            await client.query(
                `UPDATE credits SET quick_remaining = ?, deep_remaining = ?, reset_at = ?, updated_at = ? WHERE user_id = ?`,
                [newLimits.quick, newLimits.deep, Math.floor(newResetAt.getTime() / 1000), Math.floor(Date.now() / 1000), userId]
            );

            return {
                allowed: true,
                remaining: scanType === "quick" ? newLimits.quick : newLimits.deep,
                tier: credit.tier,
                resetAt: newResetAt,
            };
        }

        const remaining = scanType === "quick" ? credit.quick_remaining : credit.deep_remaining;

        return {
            allowed: remaining > 0,
            remaining,
            tier: credit.tier,
            resetAt,
        };
    },

    /**
     * Deduct a credit after successful scan
     */
    async deductCredit(userId: string, scanType: "quick" | "deep"): Promise<void> {
        const client = new D1HttpClient();
        const result = await client.query<{
            quick_remaining: number;
            deep_remaining: number;
        }>(
            `SELECT quick_remaining, deep_remaining FROM credits WHERE user_id = ? LIMIT 1`,
            [userId]
        );

        if (result.results.length === 0) {
            throw new Error("Credit record not found");
        }

        const credit = result.results[0];
        const updates = scanType === "quick"
            ? { quickRemaining: Math.max(0, credit.quick_remaining - 1) }
            : { deepRemaining: Math.max(0, credit.deep_remaining - 1) };

        const column = scanType === "quick" ? "quick_remaining" : "deep_remaining";
        await client.query(
            `UPDATE credits SET ${column} = ?, updated_at = ? WHERE user_id = ?`,
            [scanType === "quick" ? updates.quickRemaining : updates.deepRemaining, Math.floor(Date.now() / 1000), userId]
        );
    },

    /**
     * Insert pending deletion
     */
    async insertPendingDeletion(userId: string, lastError: string): Promise<void> {
        const client = new D1HttpClient();
        await client.query(
            `INSERT INTO pending_deletions (user_id, last_error, created_at)
             VALUES (?, ?, ?)`,
            [userId, lastError, Math.floor(Date.now() / 1000)]
        );
    },

    /**
     * Get pending deletions
     */
    async getPendingDeletions(): Promise<Array<{
        id: number;
        userId: string;
        status: string;
        retryCount: number;
        lastError: string | null;
    }>> {
        const client = new D1HttpClient();
        const result = await client.query<{
            id: number;
            user_id: string;
            status: string;
            retry_count: number;
            last_error: string | null;
        }>(
            `SELECT * FROM pending_deletions WHERE status = 'pending' AND retry_count < 5`
        );

        return result.results.map(row => ({
            id: row.id,
            userId: row.user_id,
            status: row.status,
            retryCount: row.retry_count,
            lastError: row.last_error,
        }));
    },

    /**
     * Update pending deletion
     */
    async updatePendingDeletion(id: number, values: {
        status?: string;
        retryCount?: number;
        lastError?: string;
    }): Promise<void> {
        const client = new D1HttpClient();
        const setClauses: string[] = [];
        const params: unknown[] = [];

        if (values.status !== undefined) {
            setClauses.push("status = ?");
            params.push(values.status);
        }
        if (values.retryCount !== undefined) {
            setClauses.push("retry_count = ?");
            params.push(values.retryCount);
        }
        if (values.lastError !== undefined) {
            setClauses.push("last_error = ?");
            params.push(values.lastError);
        }
        setClauses.push("last_attempt_at = ?");
        params.push(Math.floor(Date.now() / 1000));

        params.push(id);

        await client.query(
            `UPDATE pending_deletions SET ${setClauses.join(", ")} WHERE id = ?`,
            params
        );
    },

    // ===========================================
    // Task History Operations
    // ===========================================

    /**
     * Insert a task history entry
     */
    async insertTaskHistory(values: {
        userId: string;
        url: string;
        goal: string;
        timeoutSeconds: number;
        success: boolean;
        output?: string | null;
        error?: string | null;
        steps?: number | null;
        durationMs?: number | null;
        videoUrl?: string | null;
        inputTokens?: number | null;
        outputTokens?: number | null;
        transcript?: string[] | null;
    }): Promise<void> {
        const client = new D1HttpClient();
        await client.query(
            `INSERT INTO task_history (user_id, url, goal, timeout_seconds, success, output, error, steps, duration_ms, video_url, input_tokens, output_tokens, transcript, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                values.userId,
                values.url,
                values.goal,
                values.timeoutSeconds,
                values.success ? 1 : 0,
                values.output ?? null,
                values.error ?? null,
                values.steps ?? null,
                values.durationMs ?? null,
                values.videoUrl ?? null,
                values.inputTokens ?? null,
                values.outputTokens ?? null,
                values.transcript ? JSON.stringify(values.transcript) : null,
                Math.floor(Date.now() / 1000),
            ]
        );
    },

    /**
     * Get all task history entries for a user
     */
    async getTaskHistory(userId: string): Promise<Array<{
        id: number;
        url: string;
        goal: string;
        timeoutSeconds: number;
        success: boolean;
        output: string | null;
        error: string | null;
        steps: number | null;
        durationMs: number | null;
        videoUrl: string | null;
        inputTokens: number | null;
        outputTokens: number | null;
        transcript: string[] | null;
        createdAt: string;
    }>> {
        const client = new D1HttpClient();
        const result = await client.query<{
            id: number;
            url: string;
            goal: string;
            timeout_seconds: number;
            success: number;
            output: string | null;
            error: string | null;
            steps: number | null;
            duration_ms: number | null;
            video_url: string | null;
            input_tokens: number | null;
            output_tokens: number | null;
            transcript: string | null;
            created_at: number;
        }>(
            `SELECT * FROM task_history WHERE user_id = ? ORDER BY created_at DESC`,
            [userId]
        );

        return result.results.map(row => ({
            id: row.id,
            url: row.url,
            goal: row.goal,
            timeoutSeconds: row.timeout_seconds,
            success: row.success === 1,
            output: row.output,
            error: row.error,
            steps: row.steps,
            durationMs: row.duration_ms,
            videoUrl: row.video_url,
            inputTokens: row.input_tokens,
            outputTokens: row.output_tokens,
            transcript: row.transcript ? JSON.parse(row.transcript) : null,
            createdAt: new Date(row.created_at * 1000).toISOString(),
        }));
    },

    /**
     * Delete a single task history entry
     */
    async deleteTaskHistoryEntry(id: number, userId: string): Promise<void> {
        const client = new D1HttpClient();
        await client.query(
            `DELETE FROM task_history WHERE id = ? AND user_id = ?`,
            [id, userId]
        );
    },

    /**
     * Delete all task history entries for a user
     */
    async deleteAllTaskHistory(userId: string): Promise<void> {
        const client = new D1HttpClient();
        await client.query(
            `DELETE FROM task_history WHERE user_id = ?`,
            [userId]
        );
    },
};

/**
 * Create a Drizzle database client from the D1 binding
 * (For use within Cloudflare Workers only)
 */
export function createDb(d1: D1Database) {
    return drizzleD1(d1, { schema });
}

export type Database = ReturnType<typeof createDb>;
export { schema };
