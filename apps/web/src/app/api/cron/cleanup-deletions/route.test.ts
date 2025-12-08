/**
 * Cleanup Deletions Cron API Route Tests
 *
 * Tests for the POST /api/cron/cleanup-deletions endpoint.
 *
 * @license Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Response type for the cleanup endpoint
interface CleanupResponse {
    success?: boolean;
    error?: string;
    message?: string;
    results?: {
        processed: number;
        succeeded: number;
        failed: number;
        markedFailed: number;
    };
}

// Mock modules
vi.mock('@libsql/client', () => ({
    createClient: vi.fn(() => ({})),
}));

vi.mock('drizzle-orm/libsql', () => ({
    drizzle: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
    eq: vi.fn((col, val) => ({ col, val, type: 'eq' })),
    and: vi.fn((...conditions) => ({ conditions, type: 'and' })),
    lt: vi.fn((col, val) => ({ col, val, type: 'lt' })),
}));

vi.mock('@/db/schema', () => ({
    credits: { userId: 'credits.userId' },
    auditHistory: { userId: 'auditHistory.userId' },
    pendingDeletions: {
        id: 'pendingDeletions.id',
        userId: 'pendingDeletions.userId',
        status: 'pendingDeletions.status',
        retryCount: 'pendingDeletions.retryCount',
    },
}));

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

const mockCreateClient = vi.mocked(createClient);
const mockDrizzle = vi.mocked(drizzle);

function createMockRequest(cronSecret?: string): NextRequest {
    const headers = new Headers();
    if (cronSecret) {
        headers.set('x-cron-secret', cronSecret);
    }
    return new NextRequest('http://localhost/api/cron/cleanup-deletions', {
        method: 'POST',
        headers,
    });
}

describe('POST /api/cron/cleanup-deletions', () => {
    const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        process.env.CRON_SECRET = 'test-secret';
        mockCreateClient.mockReturnValue({} as ReturnType<typeof createClient>);
        mockDrizzle.mockReturnValue(mockDb as unknown as ReturnType<typeof drizzle>);

        // Reset mock chain
        mockDb.select.mockReturnThis();
        mockDb.from.mockReturnThis();
        mockDb.where.mockResolvedValue([]);
        mockDb.delete.mockReturnThis();
        mockDb.update.mockReturnThis();
        mockDb.set.mockReturnThis();
    });

    describe('Authentication', () => {
        it('should return 401 without cron secret', async () => {
            const request = createMockRequest();
            const response = await POST(request);
            const data = await response.json() as CleanupResponse;

            expect(response.status).toBe(401);
            expect(data.error).toBe('Unauthorized');
        });

        it('should return 401 with invalid cron secret', async () => {
            const request = createMockRequest('wrong-secret');
            const response = await POST(request);
            const data = await response.json() as CleanupResponse;

            expect(response.status).toBe(401);
            expect(data.error).toBe('Unauthorized');
        });

        it('should proceed with valid cron secret', async () => {
            const request = createMockRequest('test-secret');
            const response = await POST(request);
            const data = await response.json() as CleanupResponse;

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });
    });

    describe('Processing pending deletions', () => {
        it('should return success with zero processed when no pending deletions', async () => {
            mockDb.where.mockResolvedValue([]);

            const request = createMockRequest('test-secret');
            const response = await POST(request);
            const data = await response.json() as CleanupResponse;

            expect(response.status).toBe(200);
            expect(data.results!.processed).toBe(0);
            expect(data.results!.succeeded).toBe(0);
        });

        it('should process pending deletions and mark as completed on success', async () => {
            mockDb.where.mockResolvedValueOnce([
                { id: 1, userId: 'user_123', retryCount: 0, status: 'pending' },
            ]).mockResolvedValue([]);

            const request = createMockRequest('test-secret');
            const response = await POST(request);
            const data = await response.json() as CleanupResponse;

            expect(response.status).toBe(200);
            expect(data.results!.processed).toBe(1);
            expect(data.results!.succeeded).toBe(1);
            expect(mockDb.update).toHaveBeenCalled();
        });

        it('should increment retry count on failure', async () => {
            mockDb.where.mockResolvedValueOnce([
                { id: 1, userId: 'user_123', retryCount: 2, status: 'pending' },
            ]).mockResolvedValue([]);

            // Make delete fail
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('DB error');
            });

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const request = createMockRequest('test-secret');
            const response = await POST(request);
            const data = await response.json() as CleanupResponse;

            expect(response.status).toBe(200);
            expect(data.results!.processed).toBe(1);
            expect(data.results!.failed).toBe(1);

            consoleErrorSpy.mockRestore();
        });

        it('should mark as failed after max retries', async () => {
            mockDb.where.mockResolvedValueOnce([
                { id: 1, userId: 'user_123', retryCount: 4, status: 'pending' },
            ]).mockResolvedValue([]);

            // Make delete fail
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('DB error');
            });

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const request = createMockRequest('test-secret');
            const response = await POST(request);
            const data = await response.json() as CleanupResponse;

            expect(response.status).toBe(200);
            expect(data.results!.processed).toBe(1);
            expect(data.results!.markedFailed).toBe(1);

            consoleErrorSpy.mockRestore();
        });
    });
});
