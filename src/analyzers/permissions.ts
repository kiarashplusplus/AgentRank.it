/**
 * Permissions Analyzer
 *
 * Analyzes robots.txt and ai.txt for AI agent permissions.
 * Weight: 20%
 *
 * Failure Condition: Explicitly blocks GPTBot or ClaudeBot.
 *
 * @license Apache-2.0
 * @author Kiarash Adl
 */

import type { Analyzer, AnalyzerContext, SignalResult } from '../types/index.js';

/**
 * Known AI agent user-agents to check for
 */
const AI_BOTS = [
    'GPTBot',
    'ClaudeBot',
    'Claude-Web',
    'Anthropic',
    'ChatGPT-User',
    'Google-Extended',
    'Googlebot',
    'Bingbot',
    'PerplexityBot',
];

export const permissionsAnalyzer: Analyzer = {
    name: 'permissions',
    weight: 20,

    async analyze(context: AnalyzerContext): Promise<SignalResult> {
        const { robotsTxt, aiTxt } = context;

        // No robots.txt = fully open
        if (!robotsTxt) {
            return {
                status: 'pass',
                score: 100,
                weight: this.weight,
                details: 'No robots.txt found - all agents allowed',
            };
        }

        // Parse robots.txt directives
        const blockedBots = parseRobotsTxt(robotsTxt);
        const aiTxtInfo = aiTxt ? parseAiTxt(aiTxt) : null;

        // Check for explicitly blocked AI bots
        const blockedAiBots = AI_BOTS.filter((bot) =>
            blockedBots.some(
                (blocked) => blocked.toLowerCase() === bot.toLowerCase() || blocked === '*'
            )
        );

        if (blockedAiBots.length > 0) {
            // Check if it's a complete block or partial
            const allBlocked = blockedAiBots.length === AI_BOTS.length || blockedBots.includes('*');

            if (allBlocked) {
                return {
                    status: 'fail',
                    score: 0,
                    weight: this.weight,
                    details: `Blocks all AI agents via robots.txt`,
                };
            }

            return {
                status: 'warn',
                score: 50,
                weight: this.weight,
                details: `Blocks some AI agents: ${blockedAiBots.join(', ')}`,
            };
        }

        // Check ai.txt for additional context
        if (aiTxtInfo?.allowsAgents === false) {
            return {
                status: 'warn',
                score: 60,
                weight: this.weight,
                details: 'ai.txt indicates restricted AI agent access',
            };
        }

        return {
            status: 'pass',
            score: 100,
            weight: this.weight,
            details: 'robots.txt allows AI agents (GPTBot, ClaudeBot)',
        };
    },
};

/**
 * Parse robots.txt and extract user-agents that are disallowed
 */
function parseRobotsTxt(content: string): string[] {
    const lines = content.split('\n');
    const blocked: string[] = [];
    let currentUserAgent = '';
    let isDisallowAll = false;

    for (const line of lines) {
        const trimmed = line.trim().toLowerCase();

        if (trimmed.startsWith('user-agent:')) {
            currentUserAgent = trimmed.replace('user-agent:', '').trim();
            isDisallowAll = false;
        } else if (trimmed.startsWith('disallow:')) {
            const path = trimmed.replace('disallow:', '').trim();
            if (path === '/' || path === '/*') {
                isDisallowAll = true;
                if (currentUserAgent) {
                    blocked.push(currentUserAgent);
                }
            }
        }
    }

    return blocked;
}

/**
 * Parse ai.txt (emerging standard for AI agent permissions)
 */
function parseAiTxt(content: string): { allowsAgents: boolean; details: string } {
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim().toLowerCase();
        if (trimmed.includes('allow:') && trimmed.includes('false')) {
            return { allowsAgents: false, details: 'ai.txt explicitly disallows agents' };
        }
    }

    return { allowsAgents: true, details: 'ai.txt allows agents' };
}
