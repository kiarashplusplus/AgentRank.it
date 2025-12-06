/**
 * AgentRank Core Library
 * 
 * Re-exports from the core package for use in the web app.
 * This allows the web app to be decoupled in the future.
 */

// When published, this would be: import { ... } from 'agentrank'
// For now, use relative import to the built dist
import type { DiagnosticTask } from '../../../../dist/core/diagnostic-prompts.js';

/**
 * Diagnostic tasks for deep scanning.
 * These are the tasks sent to the browser-use engine.
 */
export const diagnosticTasks: Array<{
    name: string;
    signal: string;
    icon: string;
    hint: string;
    prompt: string;
}> = [
        {
            name: 'Analyzing Structure',
            signal: 'structure',
            icon: '🔍',
            hint: 'Finding headings, navigation, and semantic HTML elements',
            prompt: `Analyze this page's HTML structure and report your findings:

1. Find and report the main heading (h1 tag)
2. Check if there is a navigation element (<nav>)
3. Check if there is a main content area (<main>)
4. Check for semantic elements: <article>, <section>, <aside>, <header>, <footer>
5. Note if the page relies heavily on generic <div> tags

Format your response as:
HEADING: [the h1 text or "MISSING"]
NAV: [YES/NO]
MAIN: [YES/NO]
SEMANTIC_COUNT: [number of semantic elements found]
NOTES: [any observations about the structure]`,
        },
        {
            name: 'Testing Accessibility',
            signal: 'accessibility',
            icon: '♿',
            hint: 'Checking button labels, image alt text, and link quality',
            prompt: `Analyze the page's accessibility for AI agents:

1. Count all buttons and check if they have readable labels (text or aria-label)
2. Count all images and check if they have alt text
3. Check link quality - are they descriptive or just "click here"?
4. Look for form inputs without labels
5. Check for proper heading hierarchy

Format your response as:
BUTTONS: [total count], [count with labels]
IMAGES: [total count], [count with alt text]
LINKS: [good/poor] - describe why
FORMS: [any issues found]
NOTES: [other accessibility observations]`,
        },
        {
            name: 'Measuring Hydration',
            signal: 'hydration',
            icon: '⏱️',
            hint: 'Testing page load speed and interactive element responsiveness',
            prompt: `Test the page's interactivity and responsiveness:

1. Note how quickly the page content appeared
2. Try to interact with a button or link - does it respond immediately?
3. Check if there are loading spinners or skeleton screens
4. Look for JavaScript-heavy dynamic content
5. Note any delays in content appearing

Format your response as:
LOAD_TIME: [fast/medium/slow] - estimate in seconds if possible
INTERACTIVE: [YES/NO] - could you interact with elements?
RESPONSIVENESS: [immediate/delayed] - how fast did interactions work?
DYNAMIC_CONTENT: [YES/NO] - is there content loaded after initial page load?
NOTES: [any observations about page performance]`,
        },
        {
            name: 'Checking Hostility',
            signal: 'hostility',
            icon: '🛡️',
            hint: 'Looking for CAPTCHAs, cookie banners, and popup blockers',
            prompt: `Check for elements that block or hinder automated access:

1. Look for CAPTCHAs (reCAPTCHA, hCaptcha, Cloudflare Turnstile)
2. Check for cookie consent banners - do they block content?
3. Look for popups or modals that appear automatically
4. Check if main content is accessible without dismissing anything
5. Look for anti-bot measures or rate limiting messages

Format your response as:
CAPTCHA: [YES/NO] - describe type if present
COOKIE_BANNER: [YES/NO/BLOCKING] - BLOCKING means it covers content
POPUPS: [YES/NO] - describe any automatic popups
CONTENT_ACCESSIBLE: [YES/NO] - can you reach the main content?
NOTES: [any observations about bot-blocking]`,
        },
    ];

export type { DiagnosticTask };
