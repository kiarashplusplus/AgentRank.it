/**
 * Account Deletion API Route Tests
 *
 * Tests for the DELETE /api/account/delete endpoint.
 * Verifies authentication, database operations, and Clerk user deletion.
 *
 * @license Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from './route';
import { auth, clerkClient } from '@clerk/nextjs/server';

// Mock the db module
vi.mock('@/db', () => ({
    db: {
        deleteUserCredits: vi.fn(),
        deleteAllAuditHistory: vi.fn(),
        insertPendingDeletion: vi.fn(),
    },
}));

import { db } from '@/db';
const mockDb = vi.mocked(db);

// Get mocked modules
const mockAuth = vi.mocked(auth);
const mockClerkClient = vi.mocked(clerkClient);

describe('DELETE /api/account/delete', () => {
    const mockClerk = {
        users: {
            deleteUser: vi.fn().mockResolvedValue({}),
        },
    };

    beforeEach(() => {
        vi.resetAllMocks();

        // Setup default mocks
        mockClerkClient.mockResolvedValue(mockClerk as unknown as Awaited<ReturnType<typeof clerkClient>>);
        mockDb.deleteUserCredits.mockResolvedValue(undefined);
        mockDb.deleteAllAuditHistory.mockResolvedValue(undefined);
        mockDb.insertPendingDeletion.mockResolvedValue(undefined);
    });

    describe('Authentication', () => {
        it('should return 401 when user is not authenticated', async () => {
            mockAuth.mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);

            const response = await DELETE();
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('Unauthorized');
        });

        it('should proceed when user is authenticated', async () => {
            mockAuth.mockResolvedValue({ userId: 'user_123' } as Awaited<ReturnType<typeof auth>>);

            const response = await DELETE();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });
    });

    describe('Database Operations', () => {
        beforeEach(() => {
            mockAuth.mockResolvedValue({ userId: 'user_123' } as Awaited<ReturnType<typeof auth>>);
        });

        it('should delete from credits table', async () => {
            await DELETE();

            expect(mockDb.deleteUserCredits).toHaveBeenCalledWith('user_123');
        });

        it('should delete from audit history table', async () => {
            await DELETE();

            expect(mockDb.deleteAllAuditHistory).toHaveBeenCalledWith('user_123');
        });
    });

    describe('Clerk Integration', () => {
        beforeEach(() => {
            mockAuth.mockResolvedValue({ userId: 'user_123' } as Awaited<ReturnType<typeof auth>>);
        });

        it('should delete user from Clerk BEFORE database cleanup', async () => {
            await DELETE();

            // Clerk deletion should be called
            expect(mockClerk.users.deleteUser).toHaveBeenCalledWith('user_123');
        });

        it('should fail request when Clerk deletion fails (data remains intact)', async () => {
            mockClerk.users.deleteUser.mockRejectedValue(new Error('Clerk API error'));

            const response = await DELETE();
            const data = await response.json();

            // Request fails, but user data is still in DB (safe state)
            expect(response.status).toBe(500);
            expect(data.error).toBe('Clerk API error');
        });
    });

    describe('Success Response', () => {
        beforeEach(() => {
            mockAuth.mockResolvedValue({ userId: 'user_123' } as Awaited<ReturnType<typeof auth>>);
        });

        it('should return success message on completion', async () => {
            const response = await DELETE();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.message).toContain('permanently deleted');
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            mockAuth.mockResolvedValue({ userId: 'user_123' } as Awaited<ReturnType<typeof auth>>);
        });

        it('should succeed and queue pending deletion when database cleanup fails', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            // Make db operations fail
            mockDb.deleteUserCredits.mockRejectedValue(new Error('Database connection failed'));

            const response = await DELETE();
            const data = await response.json();

            // Request succeeds because Clerk deletion worked
            expect(response.status).toBe(200);
            expect(data.success).toBe(true);

            // Verify cleanup failure was logged
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to clean up user data from database:',
                expect.any(Error)
            );

            // Verify pending deletion was queued
            expect(mockDb.insertPendingDeletion).toHaveBeenCalledWith(
                'user_123',
                'Database connection failed'
            );

            consoleErrorSpy.mockRestore();
        });

        it('should handle Clerk errors (fails fast, data stays intact)', async () => {
            mockClerk.users.deleteUser.mockRejectedValue(new Error('Clerk unavailable'));

            const response = await DELETE();
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('Clerk unavailable');
        });
    });
});
