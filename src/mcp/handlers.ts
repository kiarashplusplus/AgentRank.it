/**
 * MCP Request Handlers
 *
 * Implements the MCP protocol schema from the PRD.
 *
 * @license Apache-2.0
 * @author Kiarash Adl
 */

import { scanUrl } from '../core/scanner.js';
import type { MCPResponse, ScanOptions } from '../types/index.js';

/**
 * MCP Request structure
 */
export interface MCPRequest {
  action: 'audit' | 'status' | 'quota';
  url?: string;
  mode?: 'quick' | 'deep';
  options?: {
    timeout?: number;
    skipEscalation?: boolean;
  };
}

/**
 * Handle an MCP request and return the response
 */
export async function handleMCPRequest(request: MCPRequest): Promise<MCPResponse> {
  switch (request.action) {
    case 'audit':
      return handleAuditRequest(request);

    case 'status':
      return handleStatusRequest();

    case 'quota':
      return handleQuotaRequest();

    default:
      return {
        status: 'error',
        meta: { url: '', cost_usd: 0 },
        agent_score: 0,
        signals: {
          permissions: { status: 'fail', details: 'Unknown action' },
          structure: { status: 'fail', details: '' },
          accessibility: { status: 'fail', details: '' },
          hydration: { status: 'fail', details: '' },
          hostility: { status: 'fail', details: '' },
        },
        narrative: { transcript: '' },
        escalation: { triggered: false },
        error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${String(request.action)}` },
      };
  }
}

/**
 * Handle audit request
 */
async function handleAuditRequest(request: MCPRequest): Promise<MCPResponse> {
  if (!request.url) {
    return createErrorResponse('MISSING_URL', 'URL is required for audit');
  }

  const options: ScanOptions = {
    url: request.url,
    mode: request.mode ?? 'quick',
    timeout: request.options?.timeout,
    skipEscalation: request.options?.skipEscalation,
  };

  try {
    const result = await scanUrl(options);

    // Transform to MCP response format
    return {
      status: result.status,
      meta: {
        url: result.meta.url,
        cost_usd: result.meta.costUsd,
      },
      agent_score: result.agentScore,
      signals: {
        permissions: {
          status: result.signals.permissions.status,
          details: result.signals.permissions.details,
        },
        structure: {
          status: result.signals.structure.status,
          details: result.signals.structure.details,
        },
        accessibility: {
          status: result.signals.accessibility.status,
          details: result.signals.accessibility.details,
        },
        hydration: {
          status: result.signals.hydration.status,
          details: result.signals.hydration.details,
        },
        hostility: {
          status: result.signals.hostility.status,
          details: result.signals.hostility.details,
        },
      },
      narrative: {
        transcript: result.narrative.transcript,
      },
      escalation: {
        triggered: result.escalation.triggered,
        reason: result.escalation.reason,
      },
      error: result.error ? { code: result.error.code, message: result.error.message } : undefined,
    };
  } catch (error) {
    return createErrorResponse(
      'SCAN_FAILED',
      error instanceof Error ? error.message : 'Scan failed'
    );
  }
}

/**
 * Handle status request
 */
function handleStatusRequest(): MCPResponse {
  return {
    status: 'success',
    meta: { url: '', cost_usd: 0 },
    agent_score: 0,
    signals: {
      permissions: { status: 'pass', details: 'Server operational' },
      structure: { status: 'pass', details: '' },
      accessibility: { status: 'pass', details: '' },
      hydration: { status: 'pass', details: '' },
      hostility: { status: 'pass', details: '' },
    },
    narrative: { transcript: 'AgentRank.it MCP Server is running.' },
    escalation: { triggered: false },
  };
}

/**
 * Handle quota request (for rate limiting info)
 */
function handleQuotaRequest(): MCPResponse {
  // TODO: Implement actual quota tracking
  return {
    status: 'success',
    meta: { url: '', cost_usd: 0 },
    agent_score: 0,
    signals: {
      permissions: { status: 'pass', details: 'Quota available' },
      structure: { status: 'pass', details: '' },
      accessibility: { status: 'pass', details: '' },
      hydration: { status: 'pass', details: '' },
      hostility: { status: 'pass', details: '' },
    },
    narrative: {
      transcript: 'Quota check: Anonymous tier - 3 scans remaining in 24h period.',
    },
    escalation: { triggered: false },
  };
}

/**
 * Create an error response
 */
function createErrorResponse(code: string, message: string): MCPResponse {
  return {
    status: 'error',
    meta: { url: '', cost_usd: 0 },
    agent_score: 0,
    signals: {
      permissions: { status: 'fail', details: message },
      structure: { status: 'fail', details: '' },
      accessibility: { status: 'fail', details: '' },
      hydration: { status: 'fail', details: '' },
      hostility: { status: 'fail', details: '' },
    },
    narrative: { transcript: '' },
    escalation: { triggered: false },
    error: { code, message },
  };
}
