/**
 * Rate Limiter Tests
 *
 * Tests for PRD Phase 1 requirement:
 * "Backend blocks anonymous IP after 4th request"
 *
 * @license Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter, createRateLimitError } from './rate-limiter.js';

describe('RateLimiter', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
        // Create a new limiter with 3 requests per 24 hours (anonymous tier)
        limiter = new RateLimiter({
            maxRequests: 3,
            windowMs: 24 * 60 * 60 * 1000, // 24 hours
        });
    });

    describe('Anonymous Tier Limits', () => {
        it('should allow first 3 requests from same IP', () => {
            const ip = '192.168.1.1';

            // First request
            const result1 = limiter.consume(ip);
            expect(result1.allowed).toBe(true);
            expect(result1.remaining).toBe(2);

            // Second request
            const result2 = limiter.consume(ip);
            expect(result2.allowed).toBe(true);
            expect(result2.remaining).toBe(1);

            // Third request
            const result3 = limiter.consume(ip);
            expect(result3.allowed).toBe(true);
            expect(result3.remaining).toBe(0);
        });

        it('should BLOCK 4th request from same IP (PRD requirement)', () => {
            const ip = '192.168.1.1';

            // Use up all 3 allowed requests
            limiter.consume(ip);
            limiter.consume(ip);
            limiter.consume(ip);

            // 4th request should be blocked
            const result = limiter.consume(ip);
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
            expect(result.retryAfterMs).toBeDefined();
            expect(result.retryAfterMs).toBeGreaterThan(0);
        });
    });

    describe('IP Isolation', () => {
        it('should track different IPs independently', () => {
            const ip1 = '192.168.1.1';
            const ip2 = '192.168.1.2';

            // Exhaust limits for IP1
            limiter.consume(ip1);
            limiter.consume(ip1);
            limiter.consume(ip1);

            // IP1 should be blocked
            expect(limiter.consume(ip1).allowed).toBe(false);

            // IP2 should still have full quota
            const result = limiter.consume(ip2);
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(2);
        });
    });

    describe('Window Reset', () => {
        it('should reset after window expires', () => {
            // Create limiter with very short window for testing
            const shortLimiter = new RateLimiter({
                maxRequests: 3,
                windowMs: 100, // 100ms
            });

            const ip = '10.0.0.1';

            // Use up all requests
            shortLimiter.consume(ip);
            shortLimiter.consume(ip);
            shortLimiter.consume(ip);
            expect(shortLimiter.consume(ip).allowed).toBe(false);

            // Wait for window to expire
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    // Should be allowed again
                    const result = shortLimiter.consume(ip);
                    expect(result.allowed).toBe(true);
                    expect(result.remaining).toBe(2);
                    resolve();
                }, 150);
            });
        });
    });

    describe('Check vs Consume', () => {
        it('check() should not count against limit', () => {
            const ip = '10.0.0.1';

            // Check multiple times
            limiter.check(ip);
            limiter.check(ip);
            limiter.check(ip);

            // Should still have full quota because check doesn't consume
            const result = limiter.consume(ip);
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(2);
        });

        it('record() should increment count', () => {
            const ip = '10.0.0.1';

            // Record 3 times
            limiter.record(ip);
            limiter.record(ip);
            limiter.record(ip);

            // Should be blocked now
            expect(limiter.check(ip).allowed).toBe(false);
        });
    });

    describe('Cleanup', () => {
        it('should clean up expired entries', async () => {
            const shortLimiter = new RateLimiter({
                maxRequests: 3,
                windowMs: 50,
            });

            shortLimiter.consume('ip1');
            shortLimiter.consume('ip2');
            expect(shortLimiter.size).toBe(2);

            // Wait for expiration
            await new Promise((resolve) => setTimeout(resolve, 100));

            const cleaned = shortLimiter.cleanup();
            expect(cleaned).toBe(2);
            expect(shortLimiter.size).toBe(0);
        });
    });

    describe('Reset', () => {
        it('should reset individual IP limits', () => {
            const ip = '10.0.0.1';

            // Exhaust limits
            limiter.consume(ip);
            limiter.consume(ip);
            limiter.consume(ip);
            expect(limiter.consume(ip).allowed).toBe(false);

            // Reset
            limiter.reset(ip);

            // Should be allowed again
            expect(limiter.consume(ip).allowed).toBe(true);
        });

        it('should clear all limits', () => {
            limiter.consume('ip1');
            limiter.consume('ip2');
            expect(limiter.size).toBe(2);

            limiter.clear();
            expect(limiter.size).toBe(0);
        });
    });
});

describe('createRateLimitError', () => {
    it('should create proper error response', () => {
        const result = {
            allowed: false,
            remaining: 0,
            resetAt: new Date(),
            retryAfterMs: 3600000,
        };

        const error = createRateLimitError(result);

        expect(error.code).toBe('RATE_LIMITED');
        expect(error.message).toContain('Rate limit exceeded');
        expect(error.retryAfterMs).toBe(3600000);
    });
});
