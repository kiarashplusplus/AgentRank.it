/**
 * Hostility Analyzer Tests
 *
 * Tests for PRD Phase 1 requirement:
 * "Test confirms #cf-turnstile triggers immediate fail (no Vision escalation)"
 *
 * @license Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { hostilityAnalyzer } from './hostility.js';
import type { AnalyzerContext } from '../types/index.js';

/**
 * Create a mock context with the given HTML
 */
function createContext(html: string): AnalyzerContext {
  return {
    url: 'https://example.com',
    html,
    robotsTxt: undefined,
    aiTxt: undefined,
    accessibilityTree: null,
    timeToInteractive: 1000,
  };
}

describe('Hostility Analyzer', () => {
  describe('Bot Blocker Detection - Cloudflare', () => {
    it('should FAIL immediately for #cf-turnstile (no escalation to Vision)', async () => {
      // The analyzer checks for literal string "#cf-turnstile" via includes()
      const html = `
                <html>
                    <body>
                        <div id="cf-turnstile" class="cf-turnstile"></div>
                        <script>window.turnstile = { render: "#cf-turnstile" };</script>
                        <h1>Welcome</h1>
                    </body>
                </html>
            `;
      const result = await hostilityAnalyzer.analyze(createContext(html));

      expect(result.status).toBe('fail');
      expect(result.score).toBe(0);
      expect(result.details).toContain('Cloudflare Turnstile');
    });

    it('should FAIL for cf-turnstile class on element', async () => {
      const html = `<div class="cf-turnstile" data-sitekey="abc123"></div>`;
      const result = await hostilityAnalyzer.analyze(createContext(html));

      expect(result.status).toBe('fail');
      expect(result.details).toContain('Cloudflare Turnstile');
    });

    it('should FAIL for challenge-running element (Cloudflare challenge)', async () => {
      const html = `<div id="challenge-running" class="challenge-running"></div>`;
      const result = await hostilityAnalyzer.analyze(createContext(html));

      expect(result.status).toBe('fail');
      expect(result.details).toContain('Cloudflare');
    });
  });

  describe('Bot Blocker Detection - reCAPTCHA', () => {
    it('should FAIL for g-recaptcha element', async () => {
      const html = `<div class="g-recaptcha" data-sitekey="abcd1234"></div>`;
      const result = await hostilityAnalyzer.analyze(createContext(html));

      expect(result.status).toBe('fail');
      expect(result.score).toBe(0);
      expect(result.details).toContain('reCAPTCHA');
    });

    it('should FAIL for recaptcha element', async () => {
      const html = `<div id="recaptcha"></div>`;
      const result = await hostilityAnalyzer.analyze(createContext(html));

      expect(result.status).toBe('fail');
    });
  });

  describe('Bot Blocker Detection - hCaptcha', () => {
    it('should FAIL for h-captcha element', async () => {
      const html = `<div class="h-captcha" data-sitekey="xyz789"></div>`;
      const result = await hostilityAnalyzer.analyze(createContext(html));

      expect(result.status).toBe('fail');
      expect(result.details).toContain('hCaptcha');
    });

    it('should FAIL for hcaptcha script', async () => {
      const html = `<script src="https://js.hcaptcha.com/1/api.js" async defer></script>`;
      const result = await hostilityAnalyzer.analyze(createContext(html));

      expect(result.status).toBe('fail');
    });
  });

  describe('Clean HTML - No Blockers', () => {
    it('should PASS for clean HTML without bot blockers', async () => {
      const html = `
                <!DOCTYPE html>
                <html>
                <head><title>Clean Site</title></head>
                <body>
                    <nav><a href="/about">About</a></nav>
                    <main>
                        <h1>Welcome</h1>
                        <button id="signup">Sign Up</button>
                    </main>
                </body>
                </html>
            `;
      const result = await hostilityAnalyzer.analyze(createContext(html));

      expect(result.status).toBe('pass');
      expect(result.score).toBe(100);
      expect(result.details).toContain('No bot-blocking');
    });

    it('should have correct weight (15%)', async () => {
      const result = await hostilityAnalyzer.analyze(createContext('<html></html>'));
      expect(result.weight).toBe(15);
    });
  });

  describe('Navigation Traps', () => {
    it('should WARN for moderate navigation traps', async () => {
      const html = `
                <a href="javascript:void(0)">Link 1</a>
                <a href="javascript:void(0)">Link 2</a>
                <a href="javascript:void(0)">Link 3</a>
                <a href="javascript:void(0)">Link 4</a>
                <a href="javascript:void(0)">Link 5</a>
                <a href="javascript:void(0)">Link 6</a>
            `;
      const result = await hostilityAnalyzer.analyze(createContext(html));

      expect(result.status).toBe('warn');
      expect(result.details).toContain('traps');
    });

    it('should FAIL for excessive navigation traps (>10)', async () => {
      // Create HTML with many navigation traps
      const traps = Array(15).fill('<a href="javascript:void(0)">Trap</a>').join('\n');
      const result = await hostilityAnalyzer.analyze(createContext(traps));

      expect(result.status).toBe('fail');
      expect(result.details).toContain('trap');
    });
  });

  describe('Edge Cases', () => {
    it('should PASS for empty HTML', async () => {
      const result = await hostilityAnalyzer.analyze(createContext(''));
      expect(result.status).toBe('pass');
    });

    it('should PASS for HTML with similar but non-matching patterns', async () => {
      const html = `
                <div class="recaptcha-info">Information about recaptcha</div>
                <p>We use Cloudflare for security</p>
            `;
      const result = await hostilityAnalyzer.analyze(createContext(html));

      // Should pass because class is "recaptcha-info" not "g-recaptcha"
      expect(result.status).toBe('pass');
    });
  });
});
