/**
 * Structure Analyzer
 *
 * Analyzes semantic HTML density.
 * Weight: 25%
 *
 * Failure Condition: Ratio of <div> tags to semantic tags is > 90% ("Div Soup").
 *
 * @license Apache-2.0
 * @author Kiarash Adl
 */

import type { Analyzer, AnalyzerContext, SignalResult } from '../types/index.js';

/**
 * Semantic HTML5 tags that indicate good structure
 */
const SEMANTIC_TAGS = [
  'article',
  'aside',
  'details',
  'figcaption',
  'figure',
  'footer',
  'header',
  'main',
  'mark',
  'nav',
  'section',
  'summary',
  'time',
  'button',
  'form',
  'input',
  'label',
  'select',
  'textarea',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'ul',
  'ol',
  'li',
  'a',
];

/**
 * Non-semantic container tags
 */
const NON_SEMANTIC_TAGS = ['div', 'span'];

export const structureAnalyzer: Analyzer = {
  name: 'structure',
  weight: 25,

  async analyze(context: AnalyzerContext): Promise<SignalResult> {
    const { html } = context;

    if (!html) {
      return {
        status: 'fail',
        score: 0,
        weight: this.weight,
        details: 'No HTML content to analyze',
      };
    }

    // Count tags
    const semanticCount = countTags(html, SEMANTIC_TAGS);
    const nonSemanticCount = countTags(html, NON_SEMANTIC_TAGS);
    const totalStructural = semanticCount + nonSemanticCount;

    if (totalStructural === 0) {
      return {
        status: 'warn',
        score: 50,
        weight: this.weight,
        details: 'Very minimal HTML structure',
      };
    }

    // Calculate semantic density
    const semanticRatio = semanticCount / totalStructural;
    const nonSemanticRatio = nonSemanticCount / totalStructural;

    // Div soup threshold from PRD: > 90% non-semantic
    if (nonSemanticRatio > 0.9) {
      return {
        status: 'fail',
        score: 10,
        weight: this.weight,
        details: `Div Soup detected (${Math.round(nonSemanticRatio * 100)}% non-semantic tags)`,
        recommendations: [
          'Replace `<div class="nav">` with `<nav>` for navigation sections',
          'Use `<main>` for primary content area instead of `<div id="content">`',
          'Add `<header>` and `<footer>` elements for page landmarks',
          'Use `<article>` for self-contained content and `<section>` for thematic groups',
          'Add heading hierarchy (h1-h6) to define document structure',
        ],
      };
    }

    if (nonSemanticRatio > 0.7) {
      return {
        status: 'warn',
        score: 50,
        weight: this.weight,
        details: `Low semantic density (${Math.round(semanticRatio * 100)}% semantic tags)`,
        recommendations: [
          'Add semantic landmarks: `<nav>`, `<main>`, `<aside>` help AI agents navigate',
          'Ensure a single `<h1>` describes the page purpose',
          'Wrap related content in `<section>` elements with headings',
        ],
      };
    }

    if (semanticRatio >= 0.5) {
      return {
        status: 'pass',
        score: 100,
        weight: this.weight,
        details: `Good semantic structure (${Math.round(semanticRatio * 100)}% semantic tags)`,
      };
    }

    return {
      status: 'pass',
      score: 80,
      weight: this.weight,
      details: `Acceptable semantic density (${Math.round(semanticRatio * 100)}% semantic tags)`,
      recommendations: ['Consider adding more semantic elements to improve agent readability'],
    };
  },
};

/**
 * Count occurrences of specified tags in HTML
 */
function countTags(html: string, tags: string[]): number {
  let count = 0;
  const lowerHtml = html.toLowerCase();

  for (const tag of tags) {
    // Match opening tags (handles attributes)
    const regex = new RegExp(`<${tag}(\\s|>|/)`, 'gi');
    const matches = lowerHtml.match(regex);
    count += matches?.length ?? 0;
  }

  return count;
}
