/**
 * AgentRank.it
 *
 * The PageSpeed Insights for the Agentic Web.
 * Measure how reliably an AI agent can navigate your site.
 *
 * @license Apache-2.0
 * @author Kiarash Adl
 */

// Core exports
export { scanUrl } from './core/scanner.js';
export { calculateScore, getGrade, getScoreSummary } from './core/score.js';

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
export { SkyvernEngine, shouldEscalateToSkyvern } from './engines/skyvern.js';

// Transcript exports
export { generateTranscript, humanizeError, createNarrativeStep } from './transcript/generator.js';

// MCP exports
export { startMCPServer, handleMCPRequest } from './mcp/server.js';
