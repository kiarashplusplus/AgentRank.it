/**
 * Hydration Analyzer
 *
 * Analyzes Time-to-Interactive for client-side JS rendering.
 * Weight: 15%
 *
 * Failure Condition: Agent times out (>5s) waiting for client-side JS to render.
 *
 * @license Apache-2.0
 * @author Kiarash Adl
 */

import type { Analyzer, AnalyzerContext, SignalResult } from '../types/index.js';

/**
 * Thresholds for Time-to-Interactive (in ms)
 */
const TTI_THRESHOLDS = {
  EXCELLENT: 1000, // < 1s
  GOOD: 2500, // < 2.5s
  ACCEPTABLE: 5000, // < 5s (PRD timeout)
};

export const hydrationAnalyzer: Analyzer = {
  name: 'hydration',
  weight: 15,

  async analyze(context: AnalyzerContext): Promise<SignalResult> {
    const { timeToInteractive, html } = context;

    // If no TTI measurement, check for SPA indicators
    if (timeToInteractive === undefined) {
      const spaRisk = detectSPACharacteristics(html ?? '');

      if (spaRisk === 'high') {
        return {
          status: 'warn',
          score: 60,
          weight: this.weight,
          details: 'Heavy JavaScript SPA detected - TTI could not be measured',
        };
      }

      return {
        status: 'pass',
        score: 80,
        weight: this.weight,
        details: 'Static or server-rendered page - no hydration concerns',
      };
    }

    // Evaluate TTI
    if (timeToInteractive > TTI_THRESHOLDS.ACCEPTABLE) {
      return {
        status: 'fail',
        score: 0,
        weight: this.weight,
        details: `Agent timeout: TTI ${formatMs(timeToInteractive)} exceeds 5s threshold`,
      };
    }

    if (timeToInteractive > TTI_THRESHOLDS.GOOD) {
      return {
        status: 'warn',
        score: 50,
        weight: this.weight,
        details: `Slow hydration: TTI ${formatMs(timeToInteractive)}`,
      };
    }

    if (timeToInteractive > TTI_THRESHOLDS.EXCELLENT) {
      return {
        status: 'pass',
        score: 80,
        weight: this.weight,
        details: `Good hydration: TTI ${formatMs(timeToInteractive)}`,
      };
    }

    return {
      status: 'pass',
      score: 100,
      weight: this.weight,
      details: `Excellent hydration: TTI ${formatMs(timeToInteractive)}`,
    };
  },
};

/**
 * Detect characteristics of heavy SPA frameworks
 */
function detectSPACharacteristics(html: string): 'high' | 'medium' | 'low' {
  const indicators = {
    // Empty body with JS placeholder
    emptyBody: /<body[^>]*>\s*<div id="(root|app|__next)">\s*<\/div>/i.test(html),
    // Common SPA frameworks
    react: /react|__NEXT_DATA__|gatsby/i.test(html),
    vue: /vue|nuxt/i.test(html),
    angular: /ng-app|angular/i.test(html),
    // Heavy bundle indicators
    heavyBundles: (html.match(/<script[^>]*src=[^>]*bundle/gi) ?? []).length > 3,
    // Minimal HTML content
    minimalContent: html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').length < 1000,
  };

  const riskFactors = Object.values(indicators).filter(Boolean).length;

  if (riskFactors >= 3) return 'high';
  if (riskFactors >= 2) return 'medium';
  return 'low';
}

/**
 * Format milliseconds to human-readable string
 */
function formatMs(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
}
