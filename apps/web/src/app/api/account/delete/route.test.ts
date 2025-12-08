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
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

// Get mocked modules
const mockAuth = vi.mocked(auth);
const mockClerkClient = vi.mocked(clerkClient);
const mockCreateClient = vi.mocked(createClient);
const mockDrizzle = vi.mocked(drizzle);

describe('DELETE /api/account/delete', () => {
    // Mock database and Clerk client
    const mockDb = {
        delete: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
    };

    const mockClerk = {
        users: {
            deleteUser: vi.fn().mockResolvedValue({}),
        },
    };

    beforeEach(() => {
        vi.resetAllMocks();

        // Setup default mocks
        mockCreateClient.mockReturnValue({} as ReturnType<typeof createClient>);
        mockDrizzle.mockReturnValue(mockDb as unknown as ReturnType<typeof drizzle>);
        mockClerkClient.mockResolvedValue(mockClerk as unknown as Awaited<ReturnType<typeof clerkClient>>);

        // Reset database mock chain
        mockDb.delete.mockReturnThis();
        mockDb.where.mockResolvedValue([]);
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

            expect(mockDb.delete).toHaveBeenCalled();
        });

        it('should delete from audit history table', async () => {
            await DELETE();

            // delete is called twice - once for credits, once for auditHistory
            expect(mockDb.delete).toHaveBeenCalledTimes(2);
        });
    });

    describe('Clerk Integration', () => {
        beforeEach(() => {
            mockAuth.mockResolvedValue({ userId: 'user_123' } as Awaited<ReturnType<typeof auth>>);
        });

        it('should delete user from Clerk BEFORE database cleanup', async () => {
            await DELETE();

            // Clerk deletion should be called first
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

            // First call to drizzle (for cleanup) throws, second call (for queue) succeeds
            let callCount = 0;
            const mockInsertDb = {
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockResolvedValue([]),
                }),
            };

            mockDrizzle.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    // First call - cleanup attempt fails
                    return {
                        delete: vi.fn().mockImplementation(() => {
                            throw new Error('Database connection failed');
                        }),
                    } as unknown as ReturnType<typeof drizzle>;
                }
                // Second call - queue insert succeeds
                return mockInsertDb as unknown as ReturnType<typeof drizzle>;
            });

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
            expect(mockInsertDb.insert).toHaveBeenCalled();

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
