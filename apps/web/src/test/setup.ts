/**
 * Test setup file
 * Configure global mocks for external dependencies
 */

import { vi } from 'vitest';

// Mock Clerk auth module
vi.mock('@clerk/nextjs/server', () => ({
    auth: vi.fn(),
    clerkClient: vi.fn(),
}));

// Mock drizzle-orm
vi.mock('drizzle-orm/libsql', () => ({
    drizzle: vi.fn(),
}));

// Mock libsql client
vi.mock('@libsql/client', () => ({
    createClient: vi.fn(),
}));
