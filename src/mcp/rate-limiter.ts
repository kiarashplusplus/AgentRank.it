/**
 * Rate Limiter for MCP Server
 *
 * Implements IP-based rate limiting per PRD monetization tiers:
 * - Anonymous: 3 Quick Scans per 24 hours
 * - Registered Free: 50 Quick Scans / month (TODO: auth)
 * - Premium: 500 Quick Scans (TODO: auth + payments)
 *
 * @license Apache-2.0
 * @author Kiarash Adl
 */

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
    /** Maximum requests allowed in the window */
    maxRequests: number;
    /** Window duration in milliseconds */
    windowMs: number;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    retryAfterMs?: number;
}

/**
 * Stored request record
 */
interface RequestRecord {
    count: number;
    windowStart: number;
}

/**
 * Default anonymous tier limits (from PRD: 3 scans per 24 hours)
 */
const ANONYMOUS_LIMITS: RateLimitConfig = {
    maxRequests: 3,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * IP-based Rate Limiter
 *
 * In-memory storage suitable for single-instance deployment.
 * For horizontal scaling, replace with Redis-backed implementation.
 */
export class RateLimiter {
    private store: Map<string, RequestRecord> = new Map();
    private config: RateLimitConfig;

    constructor(config: RateLimitConfig = ANONYMOUS_LIMITS) {
        this.config = config;
    }

    /**
     * Check if a request from the given IP is allowed
     */
    check(ip: string): RateLimitResult {
        const now = Date.now();
        const record = this.store.get(ip);

        // No previous requests from this IP
        if (!record) {
            return {
                allowed: true,
                remaining: this.config.maxRequests - 1,
                resetAt: new Date(now + this.config.windowMs),
            };
        }

        const windowEnd = record.windowStart + this.config.windowMs;

        // Window has expired, reset
        if (now >= windowEnd) {
            return {
                allowed: true,
                remaining: this.config.maxRequests - 1,
                resetAt: new Date(now + this.config.windowMs),
            };
        }

        // Within window, check count
        const remaining = this.config.maxRequests - record.count;

        if (remaining <= 0) {
            return {
                allowed: false,
                remaining: 0,
                resetAt: new Date(windowEnd),
                retryAfterMs: windowEnd - now,
            };
        }

        return {
            allowed: true,
            remaining: remaining - 1,
            resetAt: new Date(windowEnd),
        };
    }

    /**
     * Record a request from the given IP
     * Call this AFTER checking and if request is allowed
     */
    record(ip: string): void {
        const now = Date.now();
        const record = this.store.get(ip);

        if (!record || now >= record.windowStart + this.config.windowMs) {
            // New window
            this.store.set(ip, {
                count: 1,
                windowStart: now,
            });
        } else {
            // Increment within window
            record.count++;
        }
    }

    /**
     * Check and record in one atomic operation
     */
    consume(ip: string): RateLimitResult {
        const result = this.check(ip);
        if (result.allowed) {
            this.record(ip);
        }
        return result;
    }

    /**
     * Reset limits for an IP (useful for testing)
     */
    reset(ip: string): void {
        this.store.delete(ip);
    }

    /**
     * Clear all stored records
     */
    clear(): void {
        this.store.clear();
    }

    /**
     * Clean up expired entries (call periodically to prevent memory leaks)
     */
    cleanup(): number {
        const now = Date.now();
        let cleaned = 0;

        for (const [ip, record] of this.store.entries()) {
            if (now >= record.windowStart + this.config.windowMs) {
                this.store.delete(ip);
                cleaned++;
            }
        }

        return cleaned;
    }

    /**
     * Get current store size (for monitoring)
     */
    get size(): number {
        return this.store.size;
    }
}

/**
 * Global rate limiter instance for anonymous users
 */
export const anonymousLimiter = new RateLimiter(ANONYMOUS_LIMITS);

/**
 * Create rate limit error response
 */
export function createRateLimitError(result: RateLimitResult): {
    code: string;
    message: string;
    retryAfterMs: number | undefined;
} {
    return {
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded. You have used all ${ANONYMOUS_LIMITS.maxRequests} scans for this 24-hour period.`,
        retryAfterMs: result.retryAfterMs,
    };
}
