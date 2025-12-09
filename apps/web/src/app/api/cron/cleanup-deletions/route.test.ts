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

// Mock the db module
vi.mock('@/db', () => ({
    db: {
        getPendingDeletions: vi.fn(),
        deleteUserCredits: vi.fn(),
        deleteAllAuditHistory: vi.fn(),
        updatePendingDeletion: vi.fn(),
    },
}));

import { db } from '@/db';
const mockDb = vi.mocked(db);

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
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.CRON_SECRET = 'test-secret';

        // Default mocks
        mockDb.getPendingDeletions.mockResolvedValue([]);
        mockDb.deleteUserCredits.mockResolvedValue(undefined);
        mockDb.deleteAllAuditHistory.mockResolvedValue(undefined);
        mockDb.updatePendingDeletion.mockResolvedValue(undefined);
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
            mockDb.getPendingDeletions.mockResolvedValue([]);

            const request = createMockRequest('test-secret');
            const response = await POST(request);
            const data = await response.json() as CleanupResponse;

            expect(response.status).toBe(200);
            expect(data.results!.processed).toBe(0);
            expect(data.results!.succeeded).toBe(0);
        });

        it('should process pending deletions and mark as completed on success', async () => {
            mockDb.getPendingDeletions.mockResolvedValue([
                { id: 1, userId: 'user_123', retryCount: 0, status: 'pending', lastError: null },
            ]);

            const request = createMockRequest('test-secret');
            const response = await POST(request);
            const data = await response.json() as CleanupResponse;

            expect(response.status).toBe(200);
            expect(data.results!.processed).toBe(1);
            expect(data.results!.succeeded).toBe(1);
            expect(mockDb.deleteUserCredits).toHaveBeenCalledWith('user_123');
            expect(mockDb.deleteAllAuditHistory).toHaveBeenCalledWith('user_123');
            expect(mockDb.updatePendingDeletion).toHaveBeenCalledWith(1, { status: 'completed' });
        });

        it('should increment retry count on failure', async () => {
            mockDb.getPendingDeletions.mockResolvedValue([
                { id: 1, userId: 'user_123', retryCount: 2, status: 'pending', lastError: null },
            ]);

            // Make delete fail
            mockDb.deleteUserCredits.mockRejectedValue(new Error('DB error'));

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const request = createMockRequest('test-secret');
            const response = await POST(request);
            const data = await response.json() as CleanupResponse;

            expect(response.status).toBe(200);
            expect(data.results!.processed).toBe(1);
            expect(data.results!.failed).toBe(1);

            // Should update with incremented retry count (2 + 1 = 3)
            expect(mockDb.updatePendingDeletion).toHaveBeenCalledWith(1, {
                retryCount: 3,
                lastError: 'DB error',
                status: 'pending',
            });

            consoleErrorSpy.mockRestore();
        });

        it('should mark as failed after max retries', async () => {
            mockDb.getPendingDeletions.mockResolvedValue([
                { id: 1, userId: 'user_123', retryCount: 4, status: 'pending', lastError: null },
            ]);

            // Make delete fail
            mockDb.deleteUserCredits.mockRejectedValue(new Error('DB error'));

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const request = createMockRequest('test-secret');
            const response = await POST(request);
            const data = await response.json() as CleanupResponse;

            expect(response.status).toBe(200);
            expect(data.results!.processed).toBe(1);
            expect(data.results!.markedFailed).toBe(1);

            // Should update with status 'failed' (retry count 4 + 1 = 5 >= MAX_RETRIES)
            expect(mockDb.updatePendingDeletion).toHaveBeenCalledWith(1, {
                retryCount: 5,
                lastError: 'DB error',
                status: 'failed',
            });

            consoleErrorSpy.mockRestore();
        });
    });
});
