/**
 * Structure Analyzer Tests
 *
 * Tests for semantic HTML density analysis.
 *
 * @license Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { structureAnalyzer } from './structure.js';
import type { AnalyzerContext } from '../types/index.js';

function createContext(html: string): AnalyzerContext {
  return {
    url: 'https://example.com',
    html,
  };
}

describe('Structure Analyzer', () => {
  describe('Semantic Density Analysis', () => {
    it('should PASS for well-structured semantic HTML', async () => {
      const html = `
        <html>
          <head><title>Test</title></head>
          <body>
            <header><nav><a href="/">Home</a></nav></header>
            <main>
              <article>
                <h1>Hello World</h1>
                <p>Content here</p>
                <section><h2>Section</h2><p>More content</p></section>
              </article>
            </main>
            <footer><p>Copyright</p></footer>
          </body>
        </html>
      `;
      const result = await structureAnalyzer.analyze(createContext(html));

      expect(result.status).toBe('pass');
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it('should FAIL for div soup (>90% non-semantic)', async () => {
      const html = `
        <html>
          <body>
            <div><div><div><div><div>
              <span>Text</span>
              <div><div><div><div><div>
                <span>More text</span>
              </div></div></div></div></div>
            </div></div></div></div></div>
          </body>
        </html>
      `;
      const result = await structureAnalyzer.analyze(createContext(html));

      expect(result.status).toBe('fail');
      expect(result.score).toBe(10);
      expect(result.details).toContain('Div Soup');
    });

    it('should WARN for low semantic density (70-90%)', async () => {
      const html = `
        <html>
          <body>
            <div><div>
              <h1>Title</h1>
              <p>Some paragraph</p>
            </div></div>
            <div><div><div><div><span>div soup here</span></div></div></div></div>
          </body>
        </html>
      `;
      const result = await structureAnalyzer.analyze(createContext(html));

      expect(result.status).toBe('warn');
      expect(result.score).toBe(50);
    });

    it('should FAIL when no HTML provided', async () => {
      const result = await structureAnalyzer.analyze(createContext(''));

      expect(result.status).toBe('fail');
      expect(result.score).toBe(0);
    });

    it('should WARN for minimal HTML structure', async () => {
      const result = await structureAnalyzer.analyze(createContext('<html></html>'));

      expect(result.status).toBe('warn');
      expect(result.details).toContain('minimal');
    });
  });

  describe('Weight', () => {
    it('should have correct weight of 25', () => {
      expect(structureAnalyzer.weight).toBe(25);
    });
  });
});
