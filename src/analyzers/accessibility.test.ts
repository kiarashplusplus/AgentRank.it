/**
 * Accessibility Analyzer Tests
 *
 * Tests for ARIA labeling and accessibility tree analysis.
 *
 * @license Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { accessibilityAnalyzer } from './accessibility.js';
import type { AnalyzerContext } from '../types/index.js';

function createContext(html: string, accessibilityTree?: unknown): AnalyzerContext {
  return {
    url: 'https://example.com',
    html,
    accessibilityTree,
  };
}

describe('Accessibility Analyzer', () => {
  describe('ARIA Label Analysis', () => {
    it('should PASS when all interactive elements have labels', async () => {
      const html = `
        <button aria-label="Submit form">Submit</button>
        <input type="text" aria-label="Email address" />
        <a href="/about">About Us</a>
      `;
      const result = await accessibilityAnalyzer.analyze(createContext(html));

      expect(result.status).toBe('pass');
      expect(result.score).toBe(100);
      expect(result.details).toContain('Excellent');
    });

    it('should PASS for labeled buttons and links', async () => {
      // Note: Analyzer only checks opening tag attributes, not inner text
      const html = `
        <button aria-label="Click Me">Click Me</button>
        <button title="Submit form">Submit</button>
        <a href="/">Home</a>
      `;
      const result = await accessibilityAnalyzer.analyze(createContext(html));

      expect(result.status).toBe('pass');
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it('should FAIL when most elements lack labels (<30%)', async () => {
      const html = `
        <input type="text" />
        <input type="email" />
        <input type="password" />
        <select></select>
        <textarea></textarea>
        <button aria-label="Submit">Submit</button>
      `;
      const result = await accessibilityAnalyzer.analyze(createContext(html));

      expect(result.status).toBe('fail');
      expect(result.score).toBe(20);
      expect(result.details).toContain('Critical');
    });

    it('should WARN when some elements lack labels (30-70%)', async () => {
      // 5 elements: 2 labeled (placeholder + aria-label), 3 unlabeled = 40% labeled = warn
      const html = `
        <input type="text" placeholder="Enter email" />
        <input type="password" />
        <input type="text" />
        <select></select>
        <button aria-label="Submit">Submit</button>
      `;
      const result = await accessibilityAnalyzer.analyze(createContext(html));

      expect(result.status).toBe('warn');
      expect(result.score).toBe(50);
    });

    it('should PASS with score 80 when no interactive elements found', async () => {
      const html = '<div><p>Static content only</p></div>';
      const result = await accessibilityAnalyzer.analyze(createContext(html));

      expect(result.status).toBe('pass');
      expect(result.score).toBe(80);
      expect(result.details).toContain('No interactive elements');
    });

    it('should recognize placeholder as a label for inputs', async () => {
      const html = `
        <input type="text" placeholder="Search..." />
        <input type="email" placeholder="Your email" />
      `;
      const result = await accessibilityAnalyzer.analyze(createContext(html));

      expect(result.status).toBe('pass');
    });
  });

  describe('Accessibility Tree Size', () => {
    it('should FAIL when accessibility tree is too large', async () => {
      const html = '<div>Small HTML</div>';
      const largeTree = 'x'.repeat(150000); // > 100k limit

      const result = await accessibilityAnalyzer.analyze(createContext(html, largeTree));

      expect(result.status).toBe('fail');
      expect(result.score).toBe(20);
      expect(result.details).toContain('too large');
    });
  });

  describe('Edge Cases', () => {
    it('should FAIL when no content provided', async () => {
      const result = await accessibilityAnalyzer.analyze(createContext(''));

      expect(result.status).toBe('fail');
      expect(result.score).toBe(0);
    });
  });

  describe('Weight', () => {
    it('should have correct weight of 25', () => {
      expect(accessibilityAnalyzer.weight).toBe(25);
    });
  });
});
