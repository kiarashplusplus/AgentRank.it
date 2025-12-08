/**
 * Permissions Analyzer Tests
 *
 * Tests for robots.txt and AI agent permission analysis.
 *
 * @license Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { permissionsAnalyzer } from './permissions.js';
import type { AnalyzerContext } from '../types/index.js';

function createContext(robotsTxt?: string, aiTxt?: string): AnalyzerContext {
    return {
        url: 'https://example.com',
        html: '<html><body>Test</body></html>',
        robotsTxt,
        aiTxt,
    };
}

describe('Permissions Analyzer', () => {
    describe('robots.txt Analysis', () => {
        it('should PASS when no robots.txt exists', async () => {
            const result = await permissionsAnalyzer.analyze(createContext(undefined));

            expect(result.status).toBe('pass');
            expect(result.score).toBe(100);
            expect(result.details).toContain('No robots.txt');
        });

        it('should PASS when robots.txt allows AI agents', async () => {
            const robotsTxt = `
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /
`;
            const result = await permissionsAnalyzer.analyze(createContext(robotsTxt));

            expect(result.status).toBe('pass');
            expect(result.score).toBe(100);
        });

        it('should FAIL when robots.txt blocks all agents with *', async () => {
            const robotsTxt = `
User-agent: *
Disallow: /
`;
            const result = await permissionsAnalyzer.analyze(createContext(robotsTxt));

            expect(result.status).toBe('fail');
            expect(result.score).toBe(0);
            expect(result.details).toContain('Blocks all AI agents');
        });

        it('should WARN when robots.txt blocks specific AI bots', async () => {
            const robotsTxt = `
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /
`;
            const result = await permissionsAnalyzer.analyze(createContext(robotsTxt));

            expect(result.status).toBe('warn');
            expect(result.score).toBe(50);
            expect(result.details).toContain('GPTBot');
            expect(result.details).toContain('ClaudeBot');
        });

        it('should PASS when only non-AI bots are blocked', async () => {
            const robotsTxt = `
User-agent: BadBot
Disallow: /

User-agent: *
Allow: /
`;
            const result = await permissionsAnalyzer.analyze(createContext(robotsTxt));

            expect(result.status).toBe('pass');
        });
    });

    describe('ai.txt Analysis', () => {
        it('should WARN when ai.txt disallows agents', async () => {
            const robotsTxt = 'User-agent: *\nAllow: /';
            const aiTxt = 'Allow: false';
            const result = await permissionsAnalyzer.analyze(createContext(robotsTxt, aiTxt));

            expect(result.status).toBe('warn');
            expect(result.details).toContain('ai.txt');
        });
    });

    describe('Weight', () => {
        it('should have correct weight of 20', () => {
            expect(permissionsAnalyzer.weight).toBe(20);
        });
    });
});
