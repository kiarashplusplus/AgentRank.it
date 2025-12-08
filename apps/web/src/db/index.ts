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
