/**
 * MCP Handlers Tests
 *
 * Tests for MCP request handling, error responses, and action routing.
 * Note: These tests mock the scanner to avoid actual network calls.
 *
 * @license Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMCPRequest, type MCPRequest } from './handlers.js';

// Mock the scanner module to avoid actual network calls
vi.mock('../core/scanner.js', () => ({
    scanUrl: vi.fn(),
}));

import { scanUrl } from '../core/scanner.js';
const mockScanUrl = vi.mocked(scanUrl);

describe('MCP Handlers', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('handleMCPRequest - routing', () => {
        it('should route audit action to audit handler', async () => {
            mockScanUrl.mockResolvedValue({
                status: 'success',
                meta: { url: 'https://example.com', scannedAt: '', durationMs: 100, costUsd: 0.002, mode: 'quick' },
                agentScore: 85,
                signals: {
                    permissions: { status: 'pass', score: 100, details: 'OK', weight: 20 },
                    structure: { status: 'pass', score: 100, details: 'OK', weight: 25 },
                    accessibility: { status: 'pass', score: 100, details: 'OK', weight: 25 },
                    hydration: { status: 'pass', score: 100, details: 'OK', weight: 15 },
                    hostility: { status: 'pass', score: 100, details: 'OK', weight: 15 },
                },
                narrative: { transcript: 'Test', steps: [] },
                escalation: { triggered: false },
            });

            const request: MCPRequest = { action: 'audit', url: 'https://example.com' };
            const response = await handleMCPRequest(request);

            expect(mockScanUrl).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.com' }));
            expect(response.status).toBe('success');
            expect(response.agent_score).toBe(85);
        });

        it('should route status action to status handler', async () => {
            const request: MCPRequest = { action: 'status' };
            const response = await handleMCPRequest(request);

            expect(mockScanUrl).not.toHaveBeenCalled();
            expect(response.status).toBe('success');
            expect(response.narrative.transcript).toContain('running');
        });

        it('should route quota action to quota handler', async () => {
            const request: MCPRequest = { action: 'quota' };
            const response = await handleMCPRequest(request);

            expect(mockScanUrl).not.toHaveBeenCalled();
            expect(response.status).toBe('success');
            expect(response.narrative.transcript).toContain('Quota');
        });

        it('should return error for unknown action', async () => {
            const request = { action: 'unknown' } as unknown as MCPRequest;
            const response = await handleMCPRequest(request);

            expect(response.status).toBe('error');
            expect(response.error?.code).toBe('UNKNOWN_ACTION');
            expect(response.error?.message).toContain('unknown');
        });
    });

    describe('handleMCPRequest - audit action', () => {
        it('should return error when URL is missing', async () => {
            const request: MCPRequest = { action: 'audit' };
            const response = await handleMCPRequest(request);

            expect(response.status).toBe('error');
            expect(response.error?.code).toBe('MISSING_URL');
            expect(response.error?.message).toContain('URL is required');
        });

        it('should pass mode option to scanner', async () => {
            mockScanUrl.mockResolvedValue({
                status: 'success',
                meta: { url: 'https://example.com', scannedAt: '', durationMs: 100, costUsd: 0.02, mode: 'deep' },
                agentScore: 90,
                signals: {
                    permissions: { status: 'pass', score: 100, details: 'OK', weight: 20 },
                    structure: { status: 'pass', score: 100, details: 'OK', weight: 25 },
                    accessibility: { status: 'pass', score: 100, details: 'OK', weight: 25 },
                    hydration: { status: 'pass', score: 100, details: 'OK', weight: 15 },
                    hostility: { status: 'pass', score: 100, details: 'OK', weight: 15 },
                },
                narrative: { transcript: 'Test', steps: [] },
                escalation: { triggered: false },
            });

            const request: MCPRequest = { action: 'audit', url: 'https://example.com', mode: 'deep' };
            await handleMCPRequest(request);

            expect(mockScanUrl).toHaveBeenCalledWith(expect.objectContaining({ mode: 'deep' }));
        });

        it('should pass timeout option to scanner', async () => {
            mockScanUrl.mockResolvedValue({
                status: 'success',
                meta: { url: 'https://example.com', scannedAt: '', durationMs: 100, costUsd: 0.002, mode: 'quick' },
                agentScore: 90,
                signals: {
                    permissions: { status: 'pass', score: 100, details: 'OK', weight: 20 },
                    structure: { status: 'pass', score: 100, details: 'OK', weight: 25 },
                    accessibility: { status: 'pass', score: 100, details: 'OK', weight: 25 },
                    hydration: { status: 'pass', score: 100, details: 'OK', weight: 15 },
                    hostility: { status: 'pass', score: 100, details: 'OK', weight: 15 },
                },
                narrative: { transcript: 'Test', steps: [] },
                escalation: { triggered: false },
            });

            const request: MCPRequest = {
                action: 'audit',
                url: 'https://example.com',
                options: { timeout: 60000 },
            };
            await handleMCPRequest(request);

            expect(mockScanUrl).toHaveBeenCalledWith(expect.objectContaining({ timeout: 60000 }));
        });

        it('should pass skipEscalation option to scanner', async () => {
            mockScanUrl.mockResolvedValue({
                status: 'success',
                meta: { url: 'https://example.com', scannedAt: '', durationMs: 100, costUsd: 0.002, mode: 'quick' },
                agentScore: 90,
                signals: {
                    permissions: { status: 'pass', score: 100, details: 'OK', weight: 20 },
                    structure: { status: 'pass', score: 100, details: 'OK', weight: 25 },
                    accessibility: { status: 'pass', score: 100, details: 'OK', weight: 25 },
                    hydration: { status: 'pass', score: 100, details: 'OK', weight: 15 },
                    hostility: { status: 'pass', score: 100, details: 'OK', weight: 15 },
                },
                narrative: { transcript: 'Test', steps: [] },
                escalation: { triggered: false },
            });

            const request: MCPRequest = {
                action: 'audit',
                url: 'https://example.com',
                options: { skipEscalation: true },
            };
            await handleMCPRequest(request);

            expect(mockScanUrl).toHaveBeenCalledWith(expect.objectContaining({ skipEscalation: true }));
        });

        it('should transform scan result to MCP response format', async () => {
            mockScanUrl.mockResolvedValue({
                status: 'success',
                meta: { url: 'https://test.com', scannedAt: '2024-01-01', durationMs: 500, costUsd: 0.002, mode: 'quick' },
                agentScore: 75,
                signals: {
                    permissions: { status: 'pass', score: 90, details: 'Permissions OK', weight: 20 },
                    structure: { status: 'warn', score: 60, details: 'Some issues', weight: 25 },
                    accessibility: { status: 'pass', score: 85, details: 'Good', weight: 25 },
                    hydration: { status: 'fail', score: 30, details: 'Slow TTI', weight: 15 },
                    hostility: { status: 'pass', score: 100, details: 'No blockers', weight: 15 },
                },
                narrative: { transcript: 'Scan complete', steps: [] },
                escalation: { triggered: true, reason: 'Visual analysis needed' },
            });

            const request: MCPRequest = { action: 'audit', url: 'https://test.com' };
            const response = await handleMCPRequest(request);

            expect(response.meta.url).toBe('https://test.com');
            expect(response.meta.cost_usd).toBe(0.002);
            expect(response.agent_score).toBe(75);
            expect(response.signals.permissions.status).toBe('pass');
            expect(response.signals.permissions.details).toBe('Permissions OK');
            expect(response.signals.hydration.status).toBe('fail');
            expect(response.escalation.triggered).toBe(true);
            expect(response.escalation.reason).toBe('Visual analysis needed');
        });

        it('should handle scanner errors gracefully', async () => {
            mockScanUrl.mockRejectedValue(new Error('Network timeout'));

            const request: MCPRequest = { action: 'audit', url: 'https://example.com' };
            const response = await handleMCPRequest(request);

            expect(response.status).toBe('error');
            expect(response.error?.code).toBe('SCAN_FAILED');
            expect(response.error?.message).toBe('Network timeout');
        });

        it('should handle non-Error exceptions', async () => {
            mockScanUrl.mockRejectedValue('String error');

            const request: MCPRequest = { action: 'audit', url: 'https://example.com' };
            const response = await handleMCPRequest(request);

            expect(response.status).toBe('error');
            expect(response.error?.code).toBe('SCAN_FAILED');
            expect(response.error?.message).toBe('Scan failed');
        });

        it('should include error info from scan result when present', async () => {
            mockScanUrl.mockResolvedValue({
                status: 'error',
                meta: { url: 'https://example.com', scannedAt: '', durationMs: 100, costUsd: 0.002, mode: 'quick' },
                agentScore: 0,
                signals: {
                    permissions: { status: 'fail', score: 0, details: '', weight: 20 },
                    structure: { status: 'fail', score: 0, details: '', weight: 25 },
                    accessibility: { status: 'fail', score: 0, details: '', weight: 25 },
                    hydration: { status: 'fail', score: 0, details: '', weight: 15 },
                    hostility: { status: 'fail', score: 0, details: '', weight: 15 },
                },
                narrative: { transcript: 'Failed', steps: [] },
                escalation: { triggered: false },
                error: { code: 'DNS_FAILURE', message: 'Could not resolve domain', recoverable: false },
            });

            const request: MCPRequest = { action: 'audit', url: 'https://bad-domain.invalid' };
            const response = await handleMCPRequest(request);

            expect(response.status).toBe('error');
            expect(response.error?.code).toBe('DNS_FAILURE');
            expect(response.error?.message).toBe('Could not resolve domain');
        });
    });

    describe('handleMCPRequest - status action', () => {
        it('should return operational status', async () => {
            const request: MCPRequest = { action: 'status' };
            const response = await handleMCPRequest(request);

            expect(response.status).toBe('success');
            expect(response.signals.permissions.status).toBe('pass');
            expect(response.signals.permissions.details).toBe('Server operational');
            expect(response.narrative.transcript).toContain('MCP Server');
        });
    });

    describe('handleMCPRequest - quota action', () => {
        it('should return quota information', async () => {
            const request: MCPRequest = { action: 'quota' };
            const response = await handleMCPRequest(request);

            expect(response.status).toBe('success');
            expect(response.signals.permissions.details).toBe('Quota available');
            expect(response.narrative.transcript).toContain('Anonymous tier');
            expect(response.narrative.transcript).toContain('3 scans');
        });
    });
});
