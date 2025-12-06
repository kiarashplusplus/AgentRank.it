/**
 * Accessibility Analyzer
 *
 * Analyzes accessibility tree depth and labeling.
 * Weight: 25%
 *
 * Failure Condition: Accessibility Tree exceeds context window or
 * interactive elements lack ARIA labels.
 *
 * @license Apache-2.0
 * @author Kiarash Adl
 */

import type { Analyzer, AnalyzerContext, SignalResult } from '../types/index.js';

/**
 * Maximum accessibility tree size before context window issues
 */
const MAX_TREE_SIZE = 100000; // ~100k tokens

/**
 * Interactive elements that should have labels
 */
const INTERACTIVE_ELEMENTS = ['button', 'input', 'select', 'textarea', 'a'];

export const accessibilityAnalyzer: Analyzer = {
    name: 'accessibility',
    weight: 25,

    async analyze(context: AnalyzerContext): Promise<SignalResult> {
        const { html, accessibilityTree } = context;

        if (!html) {
            return {
                status: 'fail',
                score: 0,
                weight: this.weight,
                details: 'No content to analyze',
            };
        }

        // Check tree size
        const treeSize =
            typeof accessibilityTree === 'string'
                ? accessibilityTree.length
                : JSON.stringify(accessibilityTree ?? '').length;

        if (treeSize > MAX_TREE_SIZE) {
            return {
                status: 'fail',
                score: 20,
                weight: this.weight,
                details: 'Accessibility tree too large - may exceed AI context window',
            };
        }

        // Check for ARIA labels on interactive elements
        const { total, labeled, missing } = analyzeLabels(html);

        if (total === 0) {
            return {
                status: 'pass',
                score: 80,
                weight: this.weight,
                details: 'No interactive elements found',
            };
        }

        const labelRatio = labeled / total;

        if (labelRatio < 0.3) {
            return {
                status: 'fail',
                score: 20,
                weight: this.weight,
                details: `Critical: ${missing} of ${total} interactive elements lack labels`,
            };
        }

        if (labelRatio < 0.7) {
            return {
                status: 'warn',
                score: 50,
                weight: this.weight,
                details: `${missing} of ${total} interactive elements missing accessible labels`,
            };
        }

        if (labelRatio < 0.9) {
            return {
                status: 'pass',
                score: 80,
                weight: this.weight,
                details: `Good: ${labeled} of ${total} interactive elements have labels`,
            };
        }

        return {
            status: 'pass',
            score: 100,
            weight: this.weight,
            details: `Excellent: All ${total} interactive elements properly labeled`,
        };
    },
};

/**
 * Analyze interactive elements for ARIA labels
 */
function analyzeLabels(html: string): { total: number; labeled: number; missing: number } {
    let total = 0;
    let labeled = 0;

    for (const element of INTERACTIVE_ELEMENTS) {
        // Match element tags
        const regex = new RegExp(`<${element}[^>]*>`, 'gi');
        const matches = html.match(regex) ?? [];

        for (const match of matches) {
            total++;

            // Check for various labeling methods
            const hasAriaLabel = /aria-label=/i.test(match);
            const hasAriaLabelledby = /aria-labelledby=/i.test(match);
            const hasTitle = /title=/i.test(match);
            const hasPlaceholder = /placeholder=/i.test(match);
            const hasValue = /value=["'][^"']+["']/i.test(match);

            // For buttons, check inner text (simplified)
            if (element === 'button') {
                // Check if it's not a self-closing style
                const hasInnerContent = !/>\s*$/.test(match);
                if (hasAriaLabel || hasAriaLabelledby || hasTitle || hasInnerContent) {
                    labeled++;
                }
            } else if (element === 'a') {
                // Links almost always have text content, count as labeled
                labeled++;
            } else if (element === 'input') {
                if (hasAriaLabel || hasAriaLabelledby || hasPlaceholder || hasValue || hasTitle) {
                    labeled++;
                }
            } else {
                if (hasAriaLabel || hasAriaLabelledby || hasTitle) {
                    labeled++;
                }
            }
        }
    }

    return {
        total,
        labeled,
        missing: total - labeled,
    };
}
