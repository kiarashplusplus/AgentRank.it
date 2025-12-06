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
 * Known bot-blocking identifiers
 */
const BOT_BLOCKERS = [
    // Cloudflare
    { id: '#cf-turnstile', name: 'Cloudflare Turnstile' },
    { id: '.cf-turnstile', name: 'Cloudflare Turnstile' },
    { id: '#challenge-running', name: 'Cloudflare Challenge' },
    { id: '#cf-wrapper', name: 'Cloudflare Wrapper' },

    // Google reCAPTCHA
    { id: '.g-recaptcha', name: 'Google reCAPTCHA' },
    { id: '#recaptcha', name: 'Google reCAPTCHA' },
    { id: 'grecaptcha', name: 'Google reCAPTCHA' },

    // hCaptcha
    { id: '.h-captcha', name: 'hCaptcha' },
    { id: '#hcaptcha', name: 'hCaptcha' },

    // Generic bot detection
    { id: 'data-bot-protection', name: 'Bot Protection' },
    { id: 'anti-bot', name: 'Anti-Bot System' },
    { id: 'bot-detection', name: 'Bot Detection' },
];

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
            };
        }

        if (trapCount > 5) {
            return {
                status: 'warn',
                score: 60,
                weight: this.weight,
                details: `Some navigation traps detected (${trapCount} traps)`,
            };
        }

        if (trapCount > 0) {
            return {
                status: 'pass',
                score: 80,
                weight: this.weight,
                details: `Minor navigation traps (${trapCount})`,
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
 */
function detectBotBlockers(html: string): string[] {
    const detected: string[] = [];

    for (const blocker of BOT_BLOCKERS) {
        if (html.includes(blocker.id)) {
            if (!detected.includes(blocker.name)) {
                detected.push(blocker.name);
            }
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
