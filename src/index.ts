/**
 * AgentRank.it
 *
 * The Page Speed for the Agentic Web.
 * Measure how reliably an AI agent can navigate your site.
 *
 * @license Apache-2.0
 * @author Kiarash Adl
 */

// Core exports
export { scanUrl } from './core/scanner.js';
export { calculateScore, getGrade, getScoreSummary } from './core/score.js';

// Diagnostic prompts (for deep scan)
export {
  diagnosticTasks,
  permissionsTask,
  structureTask,
  accessibilityTask,
  hydrationTask,
  hostilityTask,
} from './core/diagnostic-prompts.js';

export type { DiagnosticTask, DiagnosticResult } from './core/diagnostic-prompts.js';

// Ideas generator
export { generateIdeas, getQuickWins } from './core/ideas.js';
export type { Idea } from './core/ideas.js';

// Type exports
export type {
  ScanResult,
  ScanOptions,
  Signals,
  SignalResult,
  SignalStatus,
  MCPResponse,
  Narrative,
  NarrativeStep,
  EscalationInfo,
  Analyzer,
  AnalyzerContext,
} from './types/index.js';

// Analyzer exports
export {
  permissionsAnalyzer,
  structureAnalyzer,
  accessibilityAnalyzer,
  hydrationAnalyzer,
  hostilityAnalyzer,
} from './analyzers/index.js';

// Engine exports
export { BrowserUseEngine } from './engines/browser-use.js';
export { BrowserUseServerEngine } from './engines/browser-use-server.js';
export { SkyvernEngine, shouldEscalateToSkyvern } from './engines/skyvern.js';

// Transcript exports
export { generateTranscript, humanizeError, createNarrativeStep } from './transcript/generator.js';

// MCP exports
export { startMCPServer, handleMCPRequest } from './mcp/server.js';
