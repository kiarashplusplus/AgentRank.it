import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Credits table for tracking user scan allowances
 *
 * Tiers (from PRD):
 * - Anonymous: 3 scans/24h (IP-based, handled in Phase 1)
 * - Free: 50 quick + 5 deep per month
 * - Premium: 500 quick + 100 deep per month
 */
export const credits = sqliteTable("credits", {
    // Clerk user ID
    userId: text("user_id").primaryKey(),

    // Quick scans (DOM-only, uses Browser Use)
    quickRemaining: integer("quick_remaining").notNull().default(50),

    // Deep scans (Vision-LLM, uses Skyvern)
    deepRemaining: integer("deep_remaining").notNull().default(5),

    // Tier: 'free' or 'premium'
    tier: text("tier").notNull().default("free"),

    // Monthly reset timestamp
    resetAt: integer("reset_at", { mode: "timestamp" }),

    // Stripe customer ID (for premium users)
    stripeCustomerId: text("stripe_customer_id"),

    // Created/updated timestamps
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
});

/**
 * Audit history for tracking scans per user
 */
export const auditHistory = sqliteTable("audit_history", {
    id: integer("id").primaryKey({ autoIncrement: true }),

    // Clerk user ID (null for anonymous)
    userId: text("user_id"),

    // Audited URL
    url: text("url").notNull(),

    // Agent score result
    agentScore: integer("agent_score").notNull(),

    // Scan mode: 'quick' or 'deep'
    mode: text("mode").notNull().default("quick"),

    // Whether escalation was triggered
    escalated: integer("escalated", { mode: "boolean" }).notNull().default(false),

    // Cost in USD (for tracking)
    costUsd: integer("cost_usd"), // stored as microdollars

    // Raw JSON result
    resultJson: text("result_json"),

    // Timestamp
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
});

// Type exports for use in application
export type Credit = typeof credits.$inferSelect;
export type NewCredit = typeof credits.$inferInsert;
export type AuditHistoryEntry = typeof auditHistory.$inferSelect;
export type NewAuditHistoryEntry = typeof auditHistory.$inferInsert;

/**
 * Pending deletions table for tracking failed cleanup attempts
 *
 * When a user's Clerk account is deleted but database cleanup fails,
 * we store the userId here for later retry via cron job.
 */
export const pendingDeletions = sqliteTable("pending_deletions", {
    id: integer("id").primaryKey({ autoIncrement: true }),

    // Clerk user ID (user is already deleted from Clerk)
    userId: text("user_id").notNull(),

    // Timestamp of first failure
    failedAt: integer("failed_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),

    // Number of retry attempts
    retryCount: integer("retry_count").notNull().default(0),

    // Last error message
    lastError: text("last_error"),

    // Status: 'pending' | 'completed' | 'failed'
    // - pending: waiting for retry
    // - completed: cleanup succeeded
    // - failed: max retries exceeded, needs manual intervention
    status: text("status").notNull().default("pending"),

    // Last attempt timestamp
    lastAttemptAt: integer("last_attempt_at", { mode: "timestamp" }),
});

// Type exports for pending deletions
export type PendingDeletion = typeof pendingDeletions.$inferSelect;
export type NewPendingDeletion = typeof pendingDeletions.$inferInsert;
