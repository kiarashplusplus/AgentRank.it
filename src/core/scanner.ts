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
import { BrowserUseServerEngine } from '../engines/browser-use-server.js';
import { generateTranscript } from '../transcript/generator.js';
import { checkRobotsTxt, RobotsBlockedError } from './robots-txt-checker.js';

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

    // Deep mode: Run diagnostic tasks using browser-use
    if (opts.mode === 'deep') {
      const { diagnosticTasks } = await import('./diagnostic-prompts.js');
      const visualEngine = new BrowserUseServerEngine();
      const engineAvailable = await visualEngine.isAvailable();

      if (engineAvailable) {
        narrativeSteps.push({
          action: 'deep_scan_start',
          result: 'success',
          humanReadable: 'Starting deep diagnostic analysis with browser-use Vision-LLM...',
        });

        // Run each diagnostic task sequentially
        for (const task of diagnosticTasks) {
          narrativeSteps.push({
            action: `diagnostic_${task.signal}_start`,
            result: 'success',
            humanReadable: `${task.icon} ${task.name}...`,
          });

          try {
            const result = await visualEngine.runTask(opts.url, task.prompt);

            if (result.success && result.output) {
              const diagnosticResult = task.parseResult(result.output);

              // Update the signal with diagnostic results
              signals[task.signal] = {
                ...signals[task.signal],
                score: diagnosticResult.score,
                status: diagnosticResult.status,
                details: diagnosticResult.details,
              };

              narrativeSteps.push({
                action: `diagnostic_${task.signal}_complete`,
                result: 'success',
                humanReadable: `${task.icon} ${diagnosticResult.findings.join('. ')}`,
              });
            } else {
              narrativeSteps.push({
                action: `diagnostic_${task.signal}_failed`,
                result: 'failure',
                rawLog: result.error,
                humanReadable: `${task.icon} Unable to complete ${task.name.toLowerCase()}: ${result.error}`,
              });
            }
          } catch (taskError) {
            narrativeSteps.push({
              action: `diagnostic_${task.signal}_error`,
              result: 'failure',
              rawLog: taskError instanceof Error ? taskError.message : 'Unknown error',
              humanReadable: `${task.icon} Error during ${task.name.toLowerCase()}`,
            });
          }
        }

        escalation = {
          triggered: true,
          reason: 'Deep mode diagnostic analysis',
          engine: 'browser-use',
        };

        narrativeSteps.push({
          action: 'deep_scan_complete',
          result: 'success',
          humanReadable:
            'Deep diagnostic analysis complete. Scores updated based on visual inspection.',
        });
      } else {
        narrativeSteps.push({
          action: 'engine_unavailable',
          result: 'skipped',
          humanReadable: 'Browser-use engine not available. Start with: docker-compose up -d',
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

      // Use browser-use server for visual analysis fallback
      const visualEngine = new BrowserUseServerEngine();
      const engineAvailable = await visualEngine.isAvailable();

      if (engineAvailable) {
        narrativeSteps.push({
          action: 'visual_scan',
          result: 'success',
          humanReadable: 'I started a visual analysis using browser-use Vision-LLM.',
        });

        const visualResult = await visualEngine.runTask(
          opts.url,
          'Analyze this page and report what you see.'
        );

        if (visualResult.success) {
          narrativeSteps.push({
            action: 'visual_complete',
            result: 'success',
            humanReadable: visualResult.output ?? 'Visual analysis completed.',
          });
        } else {
          narrativeSteps.push({
            action: 'visual_failed',
            result: 'failure',
            rawLog: visualResult.error,
            humanReadable: `Visual analysis failed: ${visualResult.error}`,
          });
        }
      } else {
        narrativeSteps.push({
          action: 'engine_unavailable',
          result: 'skipped',
          humanReadable: 'Browser-use engine not available. Start with: docker-compose up -d',
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

  // Check if we're allowed to scan this URL per robots.txt
  const urlPath = new URL(url).pathname;
  const robotsCheck = checkRobotsTxt(robotsTxt, urlPath);

  if (!robotsCheck.allowed) {
    steps.push({
      action: 'robots_check',
      result: 'failure',
      rawLog: robotsCheck.matchedRule,
      humanReadable: `This URL is disallowed by robots.txt: ${robotsCheck.matchedRule ?? 'Disallow rule matched'}`,
    });
    throw new RobotsBlockedError(robotsCheck.matchedRule);
  }

  steps.push({
    action: 'robots_check',
    result: 'success',
    humanReadable: 'robots.txt allows scanning this URL.',
  });

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
):
  | 'DNS_FAILURE'
  | 'TIMEOUT'
  | 'CONTEXT_EXCEEDED'
  | 'HOSTILITY_BLOCKED'
  | 'ROBOTS_BLOCKED'
  | 'UNKNOWN' {
  if (message.includes('ENOTFOUND') || message.includes('DNS')) return 'DNS_FAILURE';
  if (message.includes('timeout') || message.includes('Timeout')) return 'TIMEOUT';
  if (message.includes('context') || message.includes('token')) return 'CONTEXT_EXCEEDED';
  if (message.includes('robots.txt') || message.includes('ROBOTS_BLOCKED')) return 'ROBOTS_BLOCKED';
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
