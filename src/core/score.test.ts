/**
 * Score Calculator Tests
 */

import { describe, it, expect } from 'vitest';
import { calculateScore, getGrade, getScoreSummary } from '../core/score.js';
import type { Signals } from '../types/index.js';

describe('calculateScore', () => {
  it('should calculate perfect score with all passing signals', () => {
    const signals: Signals = {
      permissions: { status: 'pass', score: 100, weight: 20, details: '' },
      structure: { status: 'pass', score: 100, weight: 25, details: '' },
      accessibility: { status: 'pass', score: 100, weight: 25, details: '' },
      hydration: { status: 'pass', score: 100, weight: 15, details: '' },
      hostility: { status: 'pass', score: 100, weight: 15, details: '' },
    };

    expect(calculateScore(signals, false)).toBe(100);
  });

  it('should calculate zero with all failing signals', () => {
    const signals: Signals = {
      permissions: { status: 'fail', score: 0, weight: 20, details: '' },
      structure: { status: 'fail', score: 0, weight: 25, details: '' },
      accessibility: { status: 'fail', score: 0, weight: 25, details: '' },
      hydration: { status: 'fail', score: 0, weight: 15, details: '' },
      hostility: { status: 'fail', score: 0, weight: 15, details: '' },
    };

    expect(calculateScore(signals, false)).toBe(0);
  });

  it('should apply escalation penalty', () => {
    const signals: Signals = {
      permissions: { status: 'pass', score: 100, weight: 20, details: '' },
      structure: { status: 'pass', score: 100, weight: 25, details: '' },
      accessibility: { status: 'pass', score: 100, weight: 25, details: '' },
      hydration: { status: 'pass', score: 100, weight: 15, details: '' },
      hostility: { status: 'pass', score: 100, weight: 15, details: '' },
    };

    // Perfect score - escalation penalty (10)
    expect(calculateScore(signals, true)).toBe(90);
  });

  it('should calculate weighted average correctly', () => {
    const signals: Signals = {
      permissions: { status: 'pass', score: 100, weight: 20, details: '' }, // 20
      structure: { status: 'warn', score: 50, weight: 25, details: '' }, // 12.5
      accessibility: { status: 'pass', score: 100, weight: 25, details: '' }, // 25
      hydration: { status: 'warn', score: 50, weight: 15, details: '' }, // 7.5
      hostility: { status: 'pass', score: 100, weight: 15, details: '' }, // 15
    };

    // Total: 80 (rounded)
    expect(calculateScore(signals, false)).toBe(80);
  });
});

describe('getGrade', () => {
  it('should return correct grades', () => {
    expect(getGrade(95)).toBe('A');
    expect(getGrade(85)).toBe('B');
    expect(getGrade(75)).toBe('C');
    expect(getGrade(65)).toBe('D');
    expect(getGrade(50)).toBe('F');
  });
});

describe('getScoreSummary', () => {
  it('should return appropriate summaries', () => {
    expect(getScoreSummary(95)).toContain('Excellent');
    expect(getScoreSummary(75)).toContain('Fair');
    expect(getScoreSummary(30)).toContain('Critical');
  });
});
