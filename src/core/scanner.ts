/**
 * AgentRank.it Core Scanner
 *
 * Main orchestrator for the Two-Speed Architecture:
 * - Level 1: Speed Reader (Browser Use / Playwright)
 * - Level 2: Visual Resolver (Skyvern fallback)
 *
 * @license Apache-2.0
 * @author Kiarash Adl
 */

import type {
  ScanOptions,
  ScanResult,
  Signals,
  EscalationInfo,
  Narrative,
  NarrativeStep,
  AnalyzerContext,
} from '../types/index.js';
import { calculateScore } from './score.js';
import {
  permissionsAnalyzer,
  structureAnalyzer,
  accessibilityAnalyzer,
  hydrationAnalyzer,
  hostilityAnalyzer,
} from '../analyzers/index.js';
import { BrowserUseEngine } from '../engines/browser-use.js';
import { SkyvernEngine } from '../engines/skyvern.js';
import { generateTranscript } from '../transcript/generator.js';

/**
 * Default scan options
 */
const DEFAULT_OPTIONS: Required<Omit<ScanOptions, 'url'>> = {
  mode: 'quick',
  timeout: 30000,
  skipEscalation: false,
  verbose: false,
};

/**
 * Cost per scan in USD (from PRD: $0.02/scan for quick mode)
 */
const COST_PER_QUICK_SCAN = 0.002;
const COST_PER_DEEP_SCAN = 0.02;

/**
 * Main entry point for scanning a URL
 */
export async function scanUrl(options: ScanOptions): Promise<ScanResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const narrativeSteps: NarrativeStep[] = [];
  let escalation: EscalationInfo = { triggered: false };

  try {
    // Initialize browser engine
    const engine = new BrowserUseEngine();

    // Build analyzer context
    const context = await buildContext(opts.url, engine, narrativeSteps, opts.timeout);

    // Check for hostility first (as per PRD: fail immediately, don't escalate)
    const hostilityResult = await hostilityAnalyzer.analyze(context);
    if (hostilityResult.status === 'fail') {
      narrativeSteps.push({
        action: 'hostility_check',
        result: 'failure',
        rawLog: 'Hostility detected',
        humanReadable: `I detected bot-blocking mechanisms on this page: ${hostilityResult.details}`,
      });

      // Return early with failed hostility score
      return buildResult(
        opts,
        startTime,
        { triggered: false },
        narrativeSteps,
        await runRemainingAnalyzers(context, hostilityResult)
      );
    }

    // Run all analyzers
    const signals = await runAllAnalyzers(context);

    // Close browser
    await engine.close();

    // Deep mode: Proactively use Skyvern for visual analysis
    if (opts.mode === 'deep') {
      const skyvern = new SkyvernEngine();
      const skyvernAvailable = await skyvern.isAvailable();

      if (skyvernAvailable) {
        narrativeSteps.push({
          action: 'skyvern_deep_scan',
          result: 'success',
          humanReadable: 'Starting visual analysis with Skyvern Vision-LLM for comprehensive audit...',
        });

        const skyvernResult = await skyvern.deepScan(opts.url);

        if (skyvernResult.success) {
          escalation = {
            triggered: true,
            reason: 'Deep mode visual analysis',
            engine: 'skyvern',
            screenshotPath: skyvernResult.screenshotPath,
          };

          narrativeSteps.push({
            action: 'skyvern_complete',
            result: 'success',
            humanReadable: skyvernResult.transcript ?? 'Visual analysis completed successfully.',
          });
        } else {
          narrativeSteps.push({
            action: 'skyvern_failed',
            result: 'failure',
            rawLog: skyvernResult.error,
            humanReadable: `Visual analysis encountered an issue: ${skyvernResult.error}. Proceeding with DOM-only results.`,
          });
        }
      } else {
        narrativeSteps.push({
          action: 'skyvern_unavailable',
          result: 'skipped',
          humanReadable: 'Skyvern not available. Start with: docker-compose -f docker-compose.skyvern.yml up -d',
        });
      }
    }

    return buildResult(opts, startTime, escalation, narrativeSteps, signals);
  } catch (error) {
    // Handle escalation triggers
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (shouldEscalate(errorMessage) && !opts.skipEscalation && opts.mode === 'deep') {
      escalation = {
        triggered: true,
        reason: errorMessage,
        engine: 'skyvern',
      };

      narrativeSteps.push({
        action: 'escalation',
        result: 'success',
        rawLog: errorMessage,
        humanReadable:
          'I encountered an issue with the page and escalated to visual analysis mode.',
      });

      // Use Skyvern for deep visual analysis
      const skyvern = new SkyvernEngine();
      const skyvernAvailable = await skyvern.isAvailable();

      if (skyvernAvailable) {
        narrativeSteps.push({
          action: 'skyvern_scan',
          result: 'success',
          humanReadable: 'I started a visual analysis using Skyvern Vision-LLM.',
        });

        const skyvernResult = await skyvern.deepScan(opts.url);

        if (skyvernResult.success && skyvernResult.screenshotPath) {
          escalation.screenshotPath = skyvernResult.screenshotPath;
          narrativeSteps.push({
            action: 'skyvern_complete',
            result: 'success',
            humanReadable: skyvernResult.transcript ?? 'Visual analysis completed.',
          });
        } else {
          narrativeSteps.push({
            action: 'skyvern_failed',
            result: 'failure',
            rawLog: skyvernResult.error,
            humanReadable: `Visual analysis failed: ${skyvernResult.error}`,
          });
        }
      } else {
        narrativeSteps.push({
          action: 'skyvern_unavailable',
          result: 'skipped',
          humanReadable: 'Skyvern service not available. Start with: docker-compose -f docker-compose.skyvern.yml up -d',
        });
      }
    }

    // Return error result
    return {
      status: 'error',
      meta: {
        url: opts.url,
        scannedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        costUsd: opts.mode === 'deep' ? COST_PER_DEEP_SCAN : COST_PER_QUICK_SCAN,
        mode: opts.mode,
      },
      agentScore: 0,
      signals: getEmptySignals(),
      narrative: {
        transcript: `Scan failed: ${errorMessage}`,
        steps: narrativeSteps,
      },
      escalation,
      error: {
        code: categorizeError(errorMessage),
        message: errorMessage,
        recoverable: escalation.triggered,
      },
    };
  }
}

/**
 * Build the analyzer context by fetching page data
 */
async function buildContext(
  url: string,
  engine: BrowserUseEngine,
  steps: NarrativeStep[],
  timeout: number
): Promise<AnalyzerContext> {
  steps.push({
    action: 'navigate',
    result: 'success',
    humanReadable: `I navigated to ${url}.`,
  });

  const { html, robotsTxt, aiTxt, accessibilityTree, timeToInteractive } = await engine.analyze(
    url,
    timeout
  );

  steps.push({
    action: 'analyze',
    result: 'success',
    humanReadable: 'I analyzed the page structure and accessibility tree.',
  });

  return {
    url,
    html,
    robotsTxt,
    aiTxt,
    accessibilityTree,
    timeToInteractive,
  };
}

/**
 * Run all five signal analyzers
 */
async function runAllAnalyzers(context: AnalyzerContext): Promise<Signals> {
  const [permissions, structure, accessibility, hydration, hostility] = await Promise.all([
    permissionsAnalyzer.analyze(context),
    structureAnalyzer.analyze(context),
    accessibilityAnalyzer.analyze(context),
    hydrationAnalyzer.analyze(context),
    hostilityAnalyzer.analyze(context),
  ]);

  return { permissions, structure, accessibility, hydration, hostility };
}

/**
 * Run analyzers excluding hostility (already run)
 */
async function runRemainingAnalyzers(
  context: AnalyzerContext,
  hostilityResult: Signals['hostility']
): Promise<Signals> {
  const [permissions, structure, accessibility, hydration] = await Promise.all([
    permissionsAnalyzer.analyze(context),
    structureAnalyzer.analyze(context),
    accessibilityAnalyzer.analyze(context),
    hydrationAnalyzer.analyze(context),
  ]);

  return { permissions, structure, accessibility, hydration, hostility: hostilityResult };
}

/**
 * Build the final result object
 */
function buildResult(
  opts: Required<ScanOptions>,
  startTime: number,
  escalation: EscalationInfo,
  steps: NarrativeStep[],
  signals: Signals
): ScanResult {
  const agentScore = calculateScore(signals, escalation.triggered);

  const narrative: Narrative = {
    transcript: generateTranscript(steps),
    steps,
  };

  return {
    status: 'success',
    meta: {
      url: opts.url,
      scannedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      costUsd: opts.mode === 'deep' ? COST_PER_DEEP_SCAN : COST_PER_QUICK_SCAN,
      mode: opts.mode,
    },
    agentScore,
    signals,
    narrative,
    escalation,
  };
}

/**
 * Check if error should trigger escalation to Visual Resolver
 */
function shouldEscalate(errorMessage: string): boolean {
  const escalationTriggers = ['InteractionFailed', 'NodeNotClickable', 'ElementIntercepted'];
  return escalationTriggers.some((trigger) => errorMessage.includes(trigger));
}

/**
 * Categorize error into PRD-defined error codes
 */
function categorizeError(
  message: string
): 'DNS_FAILURE' | 'TIMEOUT' | 'CONTEXT_EXCEEDED' | 'HOSTILITY_BLOCKED' | 'UNKNOWN' {
  if (message.includes('ENOTFOUND') || message.includes('DNS')) return 'DNS_FAILURE';
  if (message.includes('timeout') || message.includes('Timeout')) return 'TIMEOUT';
  if (message.includes('context') || message.includes('token')) return 'CONTEXT_EXCEEDED';
  if (message.includes('blocked') || message.includes('captcha')) return 'HOSTILITY_BLOCKED';
  return 'UNKNOWN';
}

/**
 * Get empty signals for error cases
 */
function getEmptySignals(): Signals {
  const empty = { status: 'fail' as const, score: 0, details: 'Not analyzed', weight: 0 };
  return {
    permissions: { ...empty, weight: 20 },
    structure: { ...empty, weight: 25 },
    accessibility: { ...empty, weight: 25 },
    hydration: { ...empty, weight: 15 },
    hostility: { ...empty, weight: 15 },
  };
}
