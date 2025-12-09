/**
 * AgentRank.it - The Page Speed for the Agentic Web
 *
 * Core types and interfaces for scan results, signals, and MCP responses.
 *
 * @license Apache-2.0
 * @author Kiarash Adl
 */

/**
 * Signal status for each analyzed metric
 */
export type SignalStatus = 'pass' | 'warn' | 'fail';

/**
 * Individual signal result with status and details
 */
export interface SignalResult {
  status: SignalStatus;
  score: number; // 0-100
  details: string;
  weight: number;
  recommendations?: string[]; // Actionable improvement suggestions
}

/**
 * All five signals that compose the Agent Visibility Score
 */
export interface Signals {
  permissions: SignalResult;
  structure: SignalResult;
  accessibility: SignalResult;
  hydration: SignalResult;
  hostility: SignalResult;
}

/**
 * Escalation metadata when Visual Resolver is triggered
 */
export interface EscalationInfo {
  triggered: boolean;
  reason?: string;
  engine?: 'skyvern' | 'browser-use';
  screenshotPath?: string;
}

/**
 * Think-Aloud narrative transcript
 */
export interface Narrative {
  transcript: string;
  steps: NarrativeStep[];
}

/**
 * Individual step in the navigation narrative
 */
export interface NarrativeStep {
  action: string;
  result: 'success' | 'failure' | 'skipped';
  rawLog?: string;
  humanReadable: string;
}

/**
 * Synthetic persona for qualitative feedback (Beta)
 */
export interface Persona {
  name: string;
  type: 'visual' | 'accessibility';
  rating: number; // 0-100
  feedback: string;
  isBeta: boolean;
}

/**
 * Meta information about the scan
 */
export interface ScanMeta {
  url: string;
  scannedAt: string;
  durationMs: number;
  costUsd: number;
  mode: 'quick' | 'deep';
}

/**
 * Complete scan result returned by the CLI and MCP
 */
export interface ScanResult {
  status: 'success' | 'error';
  meta: ScanMeta;
  agentScore: number; // 0-100 weighted composite
  signals: Signals;
  narrative: Narrative;
  escalation: EscalationInfo;
  personas?: Persona[];
  error?: ScanError;
}

/**
 * Error types for failure modes
 */
export interface ScanError {
  code: ScanErrorCode;
  message: string;
  recoverable: boolean;
}

/**
 * Error codes matching PRD failure modes
 */
export type ScanErrorCode =
  | 'DNS_FAILURE'
  | 'TIMEOUT'
  | 'SKYVERN_BUSY'
  | 'CONTEXT_EXCEEDED'
  | 'HOSTILITY_BLOCKED'
  | 'ROBOTS_BLOCKED'
  | 'UNKNOWN';

/**
 * MCP Protocol response schema (matches PRD Section 4C)
 */
export interface MCPResponse {
  status: 'success' | 'error';
  meta: {
    url: string;
    cost_usd: number;
  };
  agent_score: number;
  signals: {
    permissions: { status: SignalStatus; details: string };
    structure: { status: SignalStatus; details: string };
    accessibility: { status: SignalStatus; details: string };
    hydration: { status: SignalStatus; details: string };
    hostility: { status: SignalStatus; details: string };
  };
  narrative: {
    transcript: string;
  };
  escalation: {
    triggered: boolean;
    reason?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Rate limit tier definitions
 */
export interface RateLimitTier {
  name: 'anonymous' | 'registered' | 'premium';
  quickScansPerPeriod: number;
  deepScansPerPeriod: number;
  periodDays: number;
  features: string[];
}

/**
 * Scanner options for configuring audit behavior
 */
export interface ScanOptions {
  url: string;
  mode?: 'quick' | 'deep';
  timeout?: number;
  skipEscalation?: boolean;
  verbose?: boolean;
}

/**
 * Analyzer interface that all signal analyzers must implement
 */
export interface Analyzer {
  name: keyof Signals;
  weight: number;
  analyze(context: AnalyzerContext): Promise<SignalResult>;
}

/**
 * Context passed to analyzers during scanning
 */
export interface AnalyzerContext {
  url: string;
  html?: string;
  dom?: unknown;
  accessibilityTree?: unknown;
  robotsTxt?: string;
  aiTxt?: string;
  timeToInteractive?: number;
}
