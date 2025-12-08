/**
 * Hydration Analyzer Tests
 *
 * Tests for Time-to-Interactive analysis.
 *
 * @license Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { hydrationAnalyzer } from './hydration.js';
import type { AnalyzerContext } from '../types/index.js';

function createContext(timeToInteractive?: number, html?: string): AnalyzerContext {
    return {
        url: 'https://example.com',
        html: html ?? '<html><body>Test</body></html>',
        timeToInteractive,
    };
}

describe('Hydration Analyzer', () => {
    describe('TTI Thresholds', () => {
        it('should PASS with score 100 for excellent TTI (<1.5s)', async () => {
            const result = await hydrationAnalyzer.analyze(createContext(1000));

            expect(result.status).toBe('pass');
            expect(result.score).toBe(100);
            expect(result.details).toContain('Excellent');
        });

        it('should PASS with score 80 for good TTI (1.5-4s)', async () => {
            const result = await hydrationAnalyzer.analyze(createContext(2500));

            expect(result.status).toBe('pass');
            expect(result.score).toBe(80);
            expect(result.details).toContain('Good');
        });

        it('should WARN for slow TTI (4-6s)', async () => {
            const result = await hydrationAnalyzer.analyze(createContext(5000));

            expect(result.status).toBe('warn');
            expect(result.score).toBe(50);
            expect(result.details).toContain('Slow');
        });

        it('should FAIL for timeout TTI (>6s)', async () => {
            const result = await hydrationAnalyzer.analyze(createContext(8000));

            expect(result.status).toBe('fail');
            expect(result.score).toBe(0);
            expect(result.details).toContain('timeout');
        });
    });

    describe('SPA Detection', () => {
        it('should WARN for heavy SPA with no TTI measurement', async () => {
            const spaHtml = `
        <html>
          <body>
            <div id="root"></div>
            <script src="bundle.js"></script>
            <script src="bundle2.js"></script>
            <script src="bundle3.js"></script>
            <script src="bundle4.js"></script>
          </body>
        </html>
      `;
            const result = await hydrationAnalyzer.analyze(createContext(undefined, spaHtml));

            expect(result.status).toBe('warn');
            expect(result.details).toContain('SPA');
        });

        it('should PASS for static page with no TTI measurement', async () => {
            const staticHtml = `
        <html>
          <body>
            <h1>Static Page</h1>
            <p>Lots of content here that doesn't require JavaScript.</p>
            <p>More paragraphs of content.</p>
          </body>
        </html>
      `;
            const result = await hydrationAnalyzer.analyze(createContext(undefined, staticHtml));

            expect(result.status).toBe('pass');
            expect(result.score).toBe(80);
            expect(result.details).toContain('Static');
        });

        it('should detect React/Next.js SPA markers', async () => {
            const nextHtml = `
        <html>
          <body>
            <div id="__next"></div>
            <script id="__NEXT_DATA__">{"props":{}}</script>
          </body>
        </html>
      `;
            const result = await hydrationAnalyzer.analyze(createContext(undefined, nextHtml));

            expect(result.status).toBe('warn');
        });
    });

    describe('Weight', () => {
        it('should have correct weight of 15', () => {
            expect(hydrationAnalyzer.weight).toBe(15);
        });
    });

    describe('Time Formatting', () => {
        it('should format TTI in seconds for values >= 1000ms', async () => {
            const result = await hydrationAnalyzer.analyze(createContext(2500));

            expect(result.details).toContain('2.5s');
        });

        it('should format TTI in milliseconds for values < 1000ms', async () => {
            const result = await hydrationAnalyzer.analyze(createContext(500));

            expect(result.details).toContain('500ms');
        });
    });
});
