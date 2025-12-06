/**
 * Transcript Generator
 *
 * Converts raw logs into "Think-Aloud" narratives.
 * Makes technical errors understandable to humans.
 *
 * From PRD:
 * - Raw: TimeoutError: selector "btn-buy" not found.
 * - Output: "I looked for a 'Buy' button, but the page layout shifted
 *           and covered it with a newsletter popup. I could not proceed."
 *
 * @license Apache-2.0
 * @author Kiarash Adl
 */

import type { NarrativeStep } from '../types/index.js';

/**
 * Generate a human-readable transcript from narrative steps
 */
export function generateTranscript(steps: NarrativeStep[]): string {
    if (steps.length === 0) {
        return 'No actions were recorded during this scan.';
    }

    const narratives = steps.map((step) => step.humanReadable);
    return narratives.join(' ');
}

/**
 * Convert a raw error to a human-readable explanation
 */
export function humanizeError(rawError: string): string {
    // TimeoutError patterns
    if (rawError.includes('TimeoutError') || rawError.includes('timeout')) {
        const selectorMatch = rawError.match(/selector ["']([^"']+)["']/);
        if (selectorMatch?.[1]) {
            return `I waited for the element "${selectorMatch[1]}" but it never appeared. The page may be loading too slowly or the element doesn't exist.`;
        }
        return 'I waited too long for the page to respond. It may be experiencing performance issues.';
    }

    // Element not found
    if (rawError.includes('not found') || rawError.includes('NodeNotFound')) {
        const elementMatch = rawError.match(/["']([^"']+)["']/);
        if (elementMatch?.[1]) {
            return `I couldn't find the element "${elementMatch[1]}" on the page. It may be hidden, renamed, or removed.`;
        }
        return 'I couldn\'t find the element I was looking for on this page.';
    }

    // Element intercepted (overlay)
    if (rawError.includes('ElementIntercepted') || rawError.includes('intercept')) {
        return 'I found the element but something was blocking it - possibly a popup, modal, or overlay that appeared on top.';
    }

    // Not clickable
    if (rawError.includes('NotClickable') || rawError.includes('disabled')) {
        return 'I found the element but it wasn\'t interactive. It may be disabled or not yet ready for use.';
    }

    // Navigation errors
    if (rawError.includes('Navigation') || rawError.includes('navigate')) {
        return 'I had trouble navigating the page. There may be JavaScript preventing normal navigation.';
    }

    // DNS/Network errors
    if (rawError.includes('ENOTFOUND') || rawError.includes('DNS')) {
        return 'I couldn\'t reach this website. The domain may not exist or there\'s a network issue.';
    }

    // SSL errors
    if (rawError.includes('SSL') || rawError.includes('certificate')) {
        return 'I encountered a security certificate issue with this site.';
    }

    // CAPTCHA/Bot detection
    if (rawError.includes('captcha') || rawError.includes('CAPTCHA')) {
        return 'This site uses CAPTCHA verification which prevents automated access.';
    }

    // Cloudflare
    if (rawError.includes('cloudflare') || rawError.includes('cf-')) {
        return 'This site is protected by Cloudflare and is blocking automated access.';
    }

    // Default fallback
    return `I encountered an issue: ${rawError.slice(0, 100)}${rawError.length > 100 ? '...' : ''}`;
}

/**
 * Create a narrative step from an action result
 */
export function createNarrativeStep(
    action: string,
    result: 'success' | 'failure' | 'skipped',
    rawLog?: string
): NarrativeStep {
    let humanReadable: string;

    switch (action) {
        case 'navigate':
            humanReadable =
                result === 'success'
                    ? 'I successfully navigated to the page.'
                    : humanizeError(rawLog ?? 'Navigation failed');
            break;

        case 'analyze':
            humanReadable =
                result === 'success'
                    ? 'I analyzed the page structure and accessibility.'
                    : 'I had trouble analyzing the page.';
            break;

        case 'hostility_check':
            humanReadable =
                result === 'success'
                    ? 'The page appears open to AI agents.'
                    : `I detected barriers to AI access: ${rawLog ?? 'unknown'}`;
            break;

        case 'escalation':
            humanReadable =
                'I couldn\'t complete the task with standard methods and escalated to visual analysis.';
            break;

        case 'click':
            humanReadable =
                result === 'success'
                    ? 'I clicked the element successfully.'
                    : humanizeError(rawLog ?? 'Click failed');
            break;

        case 'type':
            humanReadable =
                result === 'success'
                    ? 'I entered the text successfully.'
                    : humanizeError(rawLog ?? 'Typing failed');
            break;

        default:
            humanReadable =
                result === 'success'
                    ? `I completed the ${action} action.`
                    : humanizeError(rawLog ?? `${action} failed`);
    }

    return {
        action,
        result,
        rawLog,
        humanReadable,
    };
}
