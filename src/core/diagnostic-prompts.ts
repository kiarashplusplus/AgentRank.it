/**
 * Diagnostic Prompts for Deep Scan
 *
 * Each prompt is designed to evaluate one of the 5 signals using browser-use.
 * The prompts are structured to produce consistent, parseable output.
 *
 * @license Apache-2.0
 */

export interface DiagnosticTask {
    name: string;
    signal: 'permissions' | 'structure' | 'accessibility' | 'hydration' | 'hostility';
    icon: string;
    prompt: string;
    parseResult: (output: string) => DiagnosticResult;
}

export interface DiagnosticResult {
    score: number; // 0-100
    status: 'pass' | 'warn' | 'fail';
    details: string;
    findings: string[];
}

/**
 * Structure Task: Analyze semantic HTML structure
 */
export const structureTask: DiagnosticTask = {
    name: 'Analyzing Structure',
    signal: 'structure',
    icon: '🔍',
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

    parseResult: (output: string): DiagnosticResult => {
        const findings: string[] = [];
        let score = 100;

        // Parse heading
        const headingMatch = output.match(/HEADING:\s*(.+)/i);
        if (headingMatch?.[1]?.toLowerCase().includes('missing')) {
            findings.push('Missing main heading (h1)');
            score -= 20;
        } else if (headingMatch?.[1]) {
            findings.push(`Main heading: "${headingMatch[1].trim()}"`);
        }

        // Parse nav
        if (output.match(/NAV:\s*NO/i)) {
            findings.push('No navigation element found');
            score -= 15;
        } else {
            findings.push('Navigation element present');
        }

        // Parse main
        if (output.match(/MAIN:\s*NO/i)) {
            findings.push('No main content area defined');
            score -= 15;
        } else {
            findings.push('Main content area defined');
        }

        // Parse semantic count
        const semanticMatch = output.match(/SEMANTIC_COUNT:\s*(\d+)/i);
        const semanticCount = semanticMatch?.[1] ? parseInt(semanticMatch[1], 10) : 0;
        if (semanticCount < 3) {
            findings.push(`Low semantic element count (${semanticCount})`);
            score -= 20;
        } else {
            findings.push(`Good semantic structure (${semanticCount} elements)`);
        }

        // Parse notes
        const notesMatch = output.match(/NOTES:\s*(.+)/is);
        if (notesMatch?.[1]) {
            findings.push(notesMatch[1].trim());
        }

        return {
            score: Math.max(0, score),
            status: score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail',
            details: findings.slice(0, 2).join('. '),
            findings,
        };
    },
};

/**
 * Accessibility Task: Check ARIA labels and keyboard navigation
 */
export const accessibilityTask: DiagnosticTask = {
    name: 'Testing Accessibility',
    signal: 'accessibility',
    icon: '♿',
    prompt: `Test this page's accessibility and report your findings:

1. Find all buttons on the page - count how many have visible text or aria-labels
2. Find all images - count how many have alt text
3. Find all form inputs - count how many have associated labels
4. Check if links have descriptive text (not just "click here")
5. Try to identify the main interactive elements

Format your response as:
BUTTONS: [total] buttons, [labeled] have labels
IMAGES: [total] images, [with_alt] have alt text
FORMS: [total] inputs, [labeled] have labels
LINKS: [good/poor] link text quality
NOTES: [any accessibility concerns found]`,

    parseResult: (output: string): DiagnosticResult => {
        const findings: string[] = [];
        let score = 100;

        // Parse buttons
        const buttonsMatch = output.match(/BUTTONS:\s*(\d+)\s*buttons?,\s*(\d+)/i);
        if (buttonsMatch?.[1] && buttonsMatch[2]) {
            const total = parseInt(buttonsMatch[1], 10);
            const labeled = parseInt(buttonsMatch[2], 10);
            if (total > 0) {
                const ratio = labeled / total;
                if (ratio < 0.8) {
                    findings.push(`${total - labeled} of ${total} buttons missing labels`);
                    score -= 25 * (1 - ratio);
                } else {
                    findings.push(`All ${total} buttons properly labeled`);
                }
            }
        }

        // Parse images
        const imagesMatch = output.match(/IMAGES:\s*(\d+)\s*images?,\s*(\d+)/i);
        if (imagesMatch?.[1] && imagesMatch[2]) {
            const total = parseInt(imagesMatch[1], 10);
            const withAlt = parseInt(imagesMatch[2], 10);
            if (total > 0 && withAlt < total) {
                findings.push(`${total - withAlt} images missing alt text`);
                score -= 15;
            }
        }

        // Parse forms
        const formsMatch = output.match(/FORMS:\s*(\d+)\s*inputs?,\s*(\d+)/i);
        if (formsMatch?.[1] && formsMatch[2]) {
            const total = parseInt(formsMatch[1], 10);
            const labeled = parseInt(formsMatch[2], 10);
            if (total > 0 && labeled < total) {
                findings.push(`${total - labeled} form fields missing labels`);
                score -= 20;
            }
        }

        // Parse links
        if (output.match(/LINKS:\s*poor/i)) {
            findings.push('Poor link text quality detected');
            score -= 10;
        }

        // Parse notes
        const notesMatch = output.match(/NOTES:\s*(.+)/is);
        if (notesMatch?.[1] && notesMatch[1].trim().length > 0) {
            findings.push(notesMatch[1].trim());
        }

        if (findings.length === 0) {
            findings.push('Good accessibility practices detected');
        }

        return {
            score: Math.max(0, Math.round(score)),
            status: score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail',
            details: findings.slice(0, 2).join('. '),
            findings,
        };
    },
};

/**
 * Hydration Task: Measure time-to-interactive
 */
export const hydrationTask: DiagnosticTask = {
    name: 'Measuring Hydration',
    signal: 'hydration',
    icon: '⏱️',
    prompt: `Test this page's interactivity and loading behavior:

1. Note if the page content loaded quickly or slowly
2. Try clicking the first button or interactive element you see
3. Report if elements respond immediately or with delay
4. Check for any loading spinners, skeleton screens, or "Loading..." text
5. Note any JavaScript errors or unresponsive elements

Format your response as:
LOAD_TIME: [fast/medium/slow]
INTERACTIVE: [YES/NO] - could interact with elements
RESPONSIVENESS: [immediate/delayed/unresponsive]
LOADING_INDICATORS: [YES/NO] - saw loading states
NOTES: [observations about page interactivity]`,

    parseResult: (output: string): DiagnosticResult => {
        const findings: string[] = [];
        let score = 100;

        // Parse load time
        if (output.match(/LOAD_TIME:\s*slow/i)) {
            findings.push('Slow page load detected');
            score -= 30;
        } else if (output.match(/LOAD_TIME:\s*medium/i)) {
            findings.push('Medium load time');
            score -= 10;
        } else {
            findings.push('Fast page load');
        }

        // Parse interactivity
        if (output.match(/INTERACTIVE:\s*NO/i)) {
            findings.push('Unable to interact with elements');
            score -= 40;
        }

        // Parse responsiveness
        if (output.match(/RESPONSIVENESS:\s*unresponsive/i)) {
            findings.push('Elements unresponsive');
            score -= 30;
        } else if (output.match(/RESPONSIVENESS:\s*delayed/i)) {
            findings.push('Delayed element responses');
            score -= 15;
        } else {
            findings.push('Elements respond immediately');
        }

        // Parse loading indicators
        if (output.match(/LOADING_INDICATORS:\s*YES/i)) {
            findings.push('Loading states observed (hydration delay)');
            score -= 10;
        }

        // Parse notes
        const notesMatch = output.match(/NOTES:\s*(.+)/is);
        if (notesMatch?.[1] && notesMatch[1].trim().length > 0) {
            findings.push(notesMatch[1].trim());
        }

        return {
            score: Math.max(0, Math.round(score)),
            status: score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail',
            details: findings.slice(0, 2).join('. '),
            findings,
        };
    },
};

/**
 * Hostility Task: Detect bot-blocking and navigation traps
 */
export const hostilityTask: DiagnosticTask = {
    name: 'Checking Hostility',
    signal: 'hostility',
    icon: '🛡️',
    prompt: `Check this page for bot-blocking and navigation barriers:

1. Look for CAPTCHA challenges (reCAPTCHA, Cloudflare Turnstile, hCaptcha)
2. Check for cookie consent banners - can you dismiss them?
3. Look for newsletter popups or modal overlays blocking content
4. Check if you can access the main content without obstacles
5. Note any verification screens or "prove you're human" challenges

Format your response as:
CAPTCHA: [YES/NO] - CAPTCHA or verification challenge present
COOKIE_BANNER: [YES/NO/BLOCKING] - cookie consent status
POPUPS: [YES/NO] - intrusive popups present
CONTENT_ACCESSIBLE: [YES/NO] - can access main content
NOTES: [description of any barriers encountered]`,

    parseResult: (output: string): DiagnosticResult => {
        const findings: string[] = [];
        let score = 100;

        // Parse CAPTCHA
        if (output.match(/CAPTCHA:\s*YES/i)) {
            findings.push('CAPTCHA challenge detected');
            score -= 50;
        } else {
            findings.push('No CAPTCHA detected');
        }

        // Parse cookie banner
        if (output.match(/COOKIE_BANNER:\s*BLOCKING/i)) {
            findings.push('Cookie banner blocks content');
            score -= 20;
        } else if (output.match(/COOKIE_BANNER:\s*YES/i)) {
            findings.push('Cookie banner present (dismissible)');
            score -= 5;
        }

        // Parse popups
        if (output.match(/POPUPS:\s*YES/i)) {
            findings.push('Intrusive popups detected');
            score -= 15;
        }

        // Parse content accessibility
        if (output.match(/CONTENT_ACCESSIBLE:\s*NO/i)) {
            findings.push('Main content not accessible');
            score -= 30;
        } else {
            findings.push('Content accessible');
        }

        // Parse notes
        const notesMatch = output.match(/NOTES:\s*(.+)/is);
        if (notesMatch?.[1] && notesMatch[1].trim().length > 0) {
            findings.push(notesMatch[1].trim());
        }

        return {
            score: Math.max(0, Math.round(score)),
            status: score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail',
            details: findings.slice(0, 2).join('. '),
            findings,
        };
    },
};

/**
 * Permissions Task: Analyze Agent Economy (robots.txt, ai.txt, token cost)
 */
export const permissionsTask: DiagnosticTask = {
    name: 'Permissions & Token Economy',
    signal: 'permissions',
    icon: '📜',
    prompt: `Analyze the 'Agent Economy' of this page. Do not summarize content; assess access costs:

1. Check for 'robots.txt' or 'ai.txt' restrictions regarding GPTBot or ClaudeBot.
2. Estimate 'Token Heaviness': Count the total distinct nodes in the Accessibility Tree. Is it >50k tokens (High Cost)?
3. Check for 'Context Trap': Are there massive encoded strings or hidden data dumps in the DOM?

Format response as:
ROBOTS_STATUS: [ALLOWED/BLOCKED/UNKNOWN]
TOKEN_ESTIMATE: [LOW/MED/HIGH]
CONTEXT_TRAP: [YES/NO]
NOTES: [Specific agent-blocking directives found]`,

    parseResult: (output: string): DiagnosticResult => {
        const findings: string[] = [];
        let score = 100;

        // Parse robots status
        if (output.match(/ROBOTS_STATUS:\s*BLOCKED/i)) {
            findings.push('AI agents blocked by robots.txt');
            score -= 40;
        } else if (output.match(/ROBOTS_STATUS:\s*UNKNOWN/i)) {
            findings.push('Unable to determine robots.txt status');
            score -= 10;
        } else {
            findings.push('AI agents allowed by robots.txt');
        }

        // Parse token estimate
        if (output.match(/TOKEN_ESTIMATE:\s*HIGH/i)) {
            findings.push('High token cost (>50k estimated)');
            score -= 30;
        } else if (output.match(/TOKEN_ESTIMATE:\s*MED/i)) {
            findings.push('Medium token cost');
            score -= 15;
        } else {
            findings.push('Low token cost');
        }

        // Parse context trap
        if (output.match(/CONTEXT_TRAP:\s*YES/i)) {
            findings.push('Context trap detected (hidden data dumps)');
            score -= 20;
        }

        // Parse notes
        const notesMatch = output.match(/NOTES:\s*(.+)/is);
        if (notesMatch?.[1] && notesMatch[1].trim().length > 0) {
            findings.push(notesMatch[1].trim());
        }

        return {
            score: Math.max(0, Math.round(score)),
            status: score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail',
            details: findings.slice(0, 2).join('. '),
            findings,
        };
    },
};

/**
 * All diagnostic tasks in execution order
 */
export const diagnosticTasks: DiagnosticTask[] = [
    permissionsTask,
    structureTask,
    accessibilityTask,
    hydrationTask,
    hostilityTask,
];
