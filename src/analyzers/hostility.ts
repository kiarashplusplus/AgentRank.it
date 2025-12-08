/**
 * Hostility Analyzer
 *
 * Detects bot-blockers and navigation traps.
 * Weight: 15%
 *
 * Failure Condition: Presence of #cf-turnstile or generic "Navigation Traps".
 *
 * Key Behavior (from PRD): If hostility detected, FAIL immediately.
 * Do NOT escalate to Vision mode - saves cost.
 *
 * @license Apache-2.0
 * @author Kiarash Adl
 */

import type { Analyzer, AnalyzerContext, SignalResult } from '../types/index.js';

/**
 * Navigation trap patterns (clicks that change nothing)
 */
const NAV_TRAP_PATTERNS = [
  // JavaScript void links
  /href=["']javascript:void/i,
  /href=["']#["']/i,
  // Disabled buttons
  /disabled\s*=\s*["']?disabled/i,
  // Overlay blockers
  /class=["'][^"']*overlay-blocker/i,
  /class=["'][^"']*modal-backdrop/i,
];

export const hostilityAnalyzer: Analyzer = {
  name: 'hostility',
  weight: 15,

  async analyze(context: AnalyzerContext): Promise<SignalResult> {
    const { html } = context;

    if (!html) {
      return {
        status: 'pass',
        score: 100,
        weight: this.weight,
        details: 'No content to analyze',
      };
    }

    // Check for bot blockers
    const detectedBlockers = detectBotBlockers(html);

    if (detectedBlockers.length > 0) {
      return {
        status: 'fail',
        score: 0,
        weight: this.weight,
        details: `Blocked by hostility: ${detectedBlockers.join(', ')}`,
        recommendations: [
          'Use honeypot spam protection instead of visible CAPTCHAs for agent-friendly access',
          'Implement server-side bot detection that allows known AI agents',
          'Add AI agent user-agents to your CAPTCHA bypass allowlist',
          'Consider providing an API endpoint as an alternative to web scraping',
        ],
      };
    }

    // Check for navigation traps
    const trapCount = detectNavigationTraps(html);

    if (trapCount > 10) {
      return {
        status: 'fail',
        score: 10,
        weight: this.weight,
        details: `High navigation trap density detected (${trapCount} traps)`,
        recommendations: [
          'Replace `href="#"` with actual navigation targets or `<button>` elements',
          'Remove `javascript:void(0)` links - use buttons for actions',
          'Ensure modal overlays can be dismissed programmatically',
          'Add proper `href` attributes to all navigation links',
        ],
      };
    }

    if (trapCount > 5) {
      return {
        status: 'warn',
        score: 60,
        weight: this.weight,
        details: `Some navigation traps detected (${trapCount} traps)`,
        recommendations: [
          'Review links with `href="#"` and convert to semantic buttons or real links',
          'Ensure disabled buttons have appropriate `aria-disabled` states',
        ],
      };
    }

    if (trapCount > 0) {
      return {
        status: 'pass',
        score: 80,
        weight: this.weight,
        details: `Minor navigation traps (${trapCount})`,
        recommendations: [
          'Consider removing remaining navigation traps for optimal agent experience',
        ],
      };
    }

    return {
      status: 'pass',
      score: 100,
      weight: this.weight,
      details: 'No bot-blocking or navigation traps detected',
    };
  },
};

/**
 * Detect known bot-blocking mechanisms
 *
 * Uses DOM-aware patterns to avoid false positives from JavaScript bundles
 * that merely reference these identifiers.
 */
function detectBotBlockers(html: string): string[] {
  const detected: string[] = [];

  // DOM-aware patterns: only match actual elements with these classes/IDs
  const DOM_PATTERNS = [
    // Cloudflare Turnstile - look for actual elements
    {
      pattern: /<[^>]+(?:id|class)\s*=\s*["'][^"']*cf-turnstile[^"']*["']/i,
      name: 'Cloudflare Turnstile',
    },
    {
      pattern: /<[^>]+(?:id|class)\s*=\s*["'][^"']*challenge-running[^"']*["']/i,
      name: 'Cloudflare Challenge',
    },
    { pattern: /<[^>]+id\s*=\s*["']cf-wrapper["']/i, name: 'Cloudflare Wrapper' },

    // Google reCAPTCHA - look for actual elements
    { pattern: /<[^>]+class\s*=\s*["'][^"']*g-recaptcha[^"']*["']/i, name: 'Google reCAPTCHA' },
    { pattern: /<[^>]+id\s*=\s*["']recaptcha["']/i, name: 'Google reCAPTCHA' },
    {
      pattern: /<script[^>]+src\s*=\s*["'][^"']*recaptcha\/api\.js[^"']*["']/i,
      name: 'Google reCAPTCHA',
    },

    // hCaptcha - look for actual elements
    { pattern: /<[^>]+class\s*=\s*["'][^"']*h-captcha[^"']*["']/i, name: 'hCaptcha' },
    { pattern: /<script[^>]+src\s*=\s*["'][^"']*hcaptcha\.com[^"']*["']/i, name: 'hCaptcha' },

    // Bot protection data attributes
    { pattern: /<[^>]+data-bot-protection\s*=/i, name: 'Bot Protection' },
  ];

  for (const { pattern, name } of DOM_PATTERNS) {
    if (pattern.test(html) && !detected.includes(name)) {
      detected.push(name);
    }
  }

  return detected;
}

/**
 * Count navigation trap patterns
 */
function detectNavigationTraps(html: string): number {
  let count = 0;

  for (const pattern of NAV_TRAP_PATTERNS) {
    const matches = html.match(new RegExp(pattern.source, 'gi'));
    count += matches?.length ?? 0;
  }

  return count;
}
