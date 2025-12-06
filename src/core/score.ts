/**
 * AgentRank.it Score Calculator
 *
 * Calculates the Agent Visibility Score (0-100) from the five signals.
 *
 * Signal Weights (from PRD):
 * - Permissions: 20%
 * - Structure: 25%
 * - Accessibility: 25%
 * - Hydration: 15%
 * - Hostility: 15%
 *
 * @license Apache-2.0
 * @author Kiarash Adl
 */

import type { Signals } from '../types/index.js';

/**
 * Escalation penalty applied when Visual Resolver is triggered
 */
const ESCALATION_PENALTY = 10;

/**
 * Calculate the weighted Agent Visibility Score
 *
 * @param signals - The five signal results
 * @param escalated - Whether the scan required visual escalation
 * @returns Score from 0-100
 */
export function calculateScore(signals: Signals, escalated: boolean): number {
    // Calculate weighted sum
    let totalScore = 0;
    let totalWeight = 0;

    for (const signal of Object.values(signals)) {
        totalScore += signal.score * (signal.weight / 100);
        totalWeight += signal.weight;
    }

    // Normalize to 0-100 (should already be if weights sum to 100)
    let normalizedScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;

    // Apply escalation penalty (from PRD: "Agent Score penalty applied")
    if (escalated) {
        normalizedScore = Math.max(0, normalizedScore - ESCALATION_PENALTY);
    }

    // Round to nearest integer
    return Math.round(normalizedScore);
}

/**
 * Get a letter grade for the score
 */
export function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
}

/**
 * Get a human-readable summary of the score
 */
export function getScoreSummary(score: number): string {
    if (score >= 90) return 'Excellent - Highly navigable by AI agents';
    if (score >= 80) return 'Good - Generally accessible to AI agents';
    if (score >= 70) return 'Fair - Some barriers to AI navigation';
    if (score >= 50) return 'Poor - Significant accessibility issues';
    return 'Critical - Major barriers to AI agent access';
}
