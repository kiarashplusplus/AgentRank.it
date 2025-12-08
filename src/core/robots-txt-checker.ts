/**
 * robots.txt Checker
 *
 * Parses robots.txt and checks if a specific URL path is allowed for scanning.
 * Used to enforce robots.txt directives before proceeding with audits.
 *
 * @license Apache-2.0
 * @author Kiarash Adl
 */

/**
 * Default user-agent for AgentRank
 */
export const AGENTRANK_USER_AGENT = 'AgentRank';

/**
 * Result of a robots.txt check
 */
export interface RobotsTxtCheckResult {
  allowed: boolean;
  matchedRule?: string;
  userAgent: string;
}

/**
 * A parsed rule from robots.txt
 */
interface RobotsTxtRule {
  type: 'allow' | 'disallow';
  path: string;
  original: string;
}

/**
 * A user-agent group with its rules
 */
interface UserAgentGroup {
  userAgents: string[];
  rules: RobotsTxtRule[];
}

/**
 * Check if a URL path is allowed by robots.txt
 *
 * @param robotsTxtContent - The content of robots.txt (undefined = allowed)
 * @param urlPath - The URL path to check (e.g., "/page/about")
 * @param userAgent - The user-agent to check for (default: AgentRank)
 * @returns Check result with allowed status and matched rule
 */
export function checkRobotsTxt(
  robotsTxtContent: string | undefined,
  urlPath: string,
  userAgent: string = AGENTRANK_USER_AGENT
): RobotsTxtCheckResult {
  // No robots.txt = everything allowed
  if (!robotsTxtContent || robotsTxtContent.trim() === '') {
    return {
      allowed: true,
      userAgent,
    };
  }

  const groups = parseRobotsTxt(robotsTxtContent);

  // Find the most specific matching group
  // Priority: exact user-agent match > wildcard (*)
  const exactMatch = groups.find((g) =>
    g.userAgents.some((ua) => ua.toLowerCase() === userAgent.toLowerCase())
  );

  const wildcardMatch = groups.find((g) => g.userAgents.includes('*'));

  // Use exact match if found, otherwise wildcard
  const matchingGroup = exactMatch ?? wildcardMatch;

  if (!matchingGroup) {
    // No applicable rules = allowed
    return {
      allowed: true,
      userAgent,
    };
  }

  // Check rules in order - most specific path match wins
  return checkRulesForPath(matchingGroup.rules, urlPath, userAgent);
}

/**
 * Parse robots.txt content into user-agent groups with rules
 */
export function parseRobotsTxt(content: string): UserAgentGroup[] {
  const lines = content.split('\n');
  const groups: UserAgentGroup[] = [];
  let currentGroup: UserAgentGroup | null = null;

  for (const line of lines) {
    // Strip inline comments (everything after #)
    const commentIndex = line.indexOf('#');
    const lineWithoutComment = commentIndex >= 0 ? line.slice(0, commentIndex) : line;
    const trimmed = lineWithoutComment.trim();

    // Skip empty lines
    if (!trimmed) {
      continue;
    }

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const directive = trimmed.slice(0, colonIndex).trim().toLowerCase();
    const value = trimmed.slice(colonIndex + 1).trim();

    if (directive === 'user-agent') {
      // If we have a current group with rules, save it
      if (currentGroup && currentGroup.rules.length > 0) {
        groups.push(currentGroup);
        currentGroup = null;
      }

      // Start or extend a user-agent group
      currentGroup ??= { userAgents: [], rules: [] };
      currentGroup.userAgents.push(value);
    } else if (directive === 'disallow' && currentGroup) {
      // Empty disallow = allow all
      if (value) {
        currentGroup.rules.push({
          type: 'disallow',
          path: value,
          original: `Disallow: ${value}`,
        });
      }
    } else if (directive === 'allow' && currentGroup) {
      if (value) {
        currentGroup.rules.push({
          type: 'allow',
          path: value,
          original: `Allow: ${value}`,
        });
      }
    }
    // Ignore other directives (sitemap, crawl-delay, etc.)
  }

  // Don't forget the last group
  if (currentGroup && currentGroup.rules.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Check rules against a path and return the result
 * Uses longest-match-wins logic per robots.txt spec
 */
function checkRulesForPath(
  rules: RobotsTxtRule[],
  urlPath: string,
  userAgent: string
): RobotsTxtCheckResult {
  // Normalize path
  const path = urlPath || '/';

  // Find the longest matching rule
  let longestMatch: { rule: RobotsTxtRule; matchLength: number } | null = null;

  for (const rule of rules) {
    const matchLength = getMatchLength(rule.path, path);
    if (matchLength > 0) {
      if (!longestMatch || matchLength > longestMatch.matchLength) {
        longestMatch = { rule, matchLength };
      }
    }
  }

  if (!longestMatch) {
    // No matching rules = allowed
    return {
      allowed: true,
      userAgent,
    };
  }

  return {
    allowed: longestMatch.rule.type === 'allow',
    matchedRule: longestMatch.rule.original,
    userAgent,
  };
}

/**
 * Get the match length of a rule path against a URL path
 * Returns 0 if no match, otherwise the length of the matched portion
 *
 * Supports:
 * - Exact prefix matching
 * - * wildcard (matches any sequence)
 * - $ end anchor
 */
function getMatchLength(rulePath: string, urlPath: string): number {
  // Handle $ end anchor
  const mustMatchEnd = rulePath.endsWith('$');
  const pattern = mustMatchEnd ? rulePath.slice(0, -1) : rulePath;

  // Handle * wildcards by converting to regex
  if (pattern.includes('*')) {
    const regexPattern = pattern.split('*').map(escapeRegex).join('.*');

    const regex = new RegExp(`^${regexPattern}${mustMatchEnd ? '$' : ''}`);
    const match = regex.exec(urlPath);

    if (match) {
      return match[0].length;
    }
    return 0;
  }

  // Simple prefix matching
  if (urlPath.startsWith(pattern)) {
    if (mustMatchEnd && urlPath !== pattern) {
      return 0;
    }
    return pattern.length;
  }

  return 0;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Custom error for robots.txt blocking
 */
export class RobotsBlockedError extends Error {
  public readonly code = 'ROBOTS_BLOCKED';
  public readonly matchedRule?: string;

  constructor(matchedRule?: string) {
    super(
      matchedRule ? `URL disallowed by robots.txt: ${matchedRule}` : 'URL disallowed by robots.txt'
    );
    this.name = 'RobotsBlockedError';
    this.matchedRule = matchedRule;
  }
}
