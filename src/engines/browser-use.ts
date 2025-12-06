/**
 * Browser Use Engine (Level 1: Speed Reader)
 *
 * Uses Playwright to analyze pages via structured Accessibility Tree.
 * This is the default engine - text-only tokens, no screenshots.
 *
 * @license Apache-2.0
 * @author Kiarash Adl
 */

import { chromium, type Browser, type Page } from 'playwright';

/**
 * Analysis result from the browser engine
 */
export interface BrowserAnalysis {
    html: string;
    robotsTxt: string | undefined;
    aiTxt: string | undefined;
    accessibilityTree: unknown;
    timeToInteractive: number;
}

/**
 * Browser Use Engine for text-based page analysis
 */
export class BrowserUseEngine {
    private browser: Browser | null = null;
    private page: Page | null = null;

    /**
     * Analyze a URL and return structured data
     */
    async analyze(url: string, timeout: number): Promise<BrowserAnalysis> {
        const startTime = Date.now();

        // Launch browser
        this.browser = await chromium.launch({
            headless: true,
        });

        this.page = await this.browser.newPage();

        // Set reasonable timeout
        this.page.setDefaultTimeout(timeout);

        // Navigate and wait for network idle
        const response = await this.page.goto(url, {
            waitUntil: 'networkidle',
            timeout,
        });

        if (!response) {
            throw new Error('DNS_FAILURE: Could not reach the site');
        }

        // Get HTML content
        const html = await this.page.content();

        // Calculate Time-to-Interactive
        const timeToInteractive = Date.now() - startTime;

        // Fetch robots.txt and ai.txt
        const baseUrl = new URL(url);
        const robotsTxt = await this.fetchOptionalResource(
            `${baseUrl.origin}/robots.txt`
        );
        const aiTxt = await this.fetchOptionalResource(`${baseUrl.origin}/ai.txt`);

        // Get accessibility tree
        const accessibilityTree = await this.getAccessibilityTree();

        return {
            html,
            robotsTxt,
            aiTxt,
            accessibilityTree,
            timeToInteractive,
        };
    }

    /**
     * Get the accessibility tree snapshot
     * 
     * Note: Returns a simplified representation. Full accessibility tree
     * analysis would require additional DOM type definitions.
     */
    private async getAccessibilityTree(): Promise<unknown> {
        if (!this.page) return null;

        try {
            // Get basic accessibility info using Playwright's locators
            const interactiveCount = await this.page.locator('button, a, input, select, textarea, [role]').count();
            const ariaLabelCount = await this.page.locator('[aria-label]').count();

            return {
                interactiveElements: interactiveCount,
                labeledElements: ariaLabelCount,
            };
        } catch {
            return null;
        }
    }

    /**
     * Fetch an optional resource (robots.txt, ai.txt)
     */
    private async fetchOptionalResource(url: string): Promise<string | undefined> {
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(5000),
            });

            if (response.ok) {
                return await response.text();
            }
        } catch {
            // Resource doesn't exist or failed - that's ok
        }
        return undefined;
    }

    /**
     * Attempt to interact with an element
     * Throws specific errors that may trigger escalation
     */
    async tryInteraction(selector: string): Promise<boolean> {
        if (!this.page) {
            throw new Error('Browser not initialized');
        }

        try {
            const element = await this.page.waitForSelector(selector, { timeout: 5000 });

            if (!element) {
                throw new Error(`InteractionFailed: Element "${selector}" not found`);
            }

            // Check if element is visible and clickable
            const isVisible = await element.isVisible();
            const isEnabled = await element.isEnabled();

            if (!isVisible) {
                throw new Error(`ElementIntercepted: Element "${selector}" is not visible`);
            }

            if (!isEnabled) {
                throw new Error(`NodeNotClickable: Element "${selector}" is disabled`);
            }

            // Attempt click
            await element.click();
            return true;
        } catch (error) {
            if (error instanceof Error) {
                // Re-throw with our error types for escalation detection
                if (error.message.includes('timeout')) {
                    throw new Error(`InteractionFailed: Timeout waiting for "${selector}"`);
                }
                throw error;
            }
            throw new Error('InteractionFailed: Unknown error');
        }
    }

    /**
     * Close the browser
     */
    async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}
