/**
 * robots.txt Checker Tests
 *
 * Comprehensive tests for robots.txt parsing and path matching.
 *
 * @license Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  checkRobotsTxt,
  parseRobotsTxt,
  RobotsBlockedError,
  AGENTRANK_USER_AGENT,
} from './robots-txt-checker.js';

describe('checkRobotsTxt', () => {
  describe('Basic Allow/Disallow', () => {
    it('should ALLOW when no robots.txt exists', () => {
      const result = checkRobotsTxt(undefined, '/page');
      expect(result.allowed).toBe(true);
    });

    it('should ALLOW when robots.txt is empty', () => {
      const result = checkRobotsTxt('', '/page');
      expect(result.allowed).toBe(true);
    });

    it('should ALLOW when no matching rules exist', () => {
      const robotsTxt = `
User-agent: Googlebot
Disallow: /
`;
      const result = checkRobotsTxt(robotsTxt, '/page');
      expect(result.allowed).toBe(true);
    });

    it('should DISALLOW when wildcard blocks all paths', () => {
      const robotsTxt = `
User-agent: *
Disallow: /
`;
      const result = checkRobotsTxt(robotsTxt, '/page');
      expect(result.allowed).toBe(false);
      expect(result.matchedRule).toBe('Disallow: /');
    });

    it('should ALLOW root when only specific path is blocked', () => {
      const robotsTxt = `
User-agent: *
Disallow: /admin/
`;
      const result = checkRobotsTxt(robotsTxt, '/');
      expect(result.allowed).toBe(true);
    });

    it('should DISALLOW specific blocked path', () => {
      const robotsTxt = `
User-agent: *
Disallow: /admin/
`;
      const result = checkRobotsTxt(robotsTxt, '/admin/settings');
      expect(result.allowed).toBe(false);
    });
  });

  describe('AgentRank User-Agent Matching', () => {
    it('should use AgentRank user-agent by default', () => {
      const robotsTxt = `
User-agent: AgentRank
Disallow: /private/
`;
      const result = checkRobotsTxt(robotsTxt, '/private/data');
      expect(result.allowed).toBe(false);
      expect(result.userAgent).toBe(AGENTRANK_USER_AGENT);
    });

    it('should prioritize specific AgentRank rules over wildcard', () => {
      const robotsTxt = `
User-agent: *
Disallow: /

User-agent: AgentRank
Allow: /
`;
      const result = checkRobotsTxt(robotsTxt, '/page');
      expect(result.allowed).toBe(true);
    });

    it('should fallback to wildcard when no AgentRank rules', () => {
      const robotsTxt = `
User-agent: *
Disallow: /blocked/
`;
      const result = checkRobotsTxt(robotsTxt, '/blocked/page');
      expect(result.allowed).toBe(false);
    });

    it('should support custom user-agent parameter', () => {
      const robotsTxt = `
User-agent: CustomBot
Disallow: /
`;
      const result = checkRobotsTxt(robotsTxt, '/page', 'CustomBot');
      expect(result.allowed).toBe(false);
      expect(result.userAgent).toBe('CustomBot');
    });
  });

  describe('Allow Overrides Disallow', () => {
    it('should use longest-match-wins for Allow vs Disallow', () => {
      const robotsTxt = `
User-agent: *
Disallow: /admin/
Allow: /admin/public/
`;
      const resultBlocked = checkRobotsTxt(robotsTxt, '/admin/settings');
      expect(resultBlocked.allowed).toBe(false);

      const resultAllowed = checkRobotsTxt(robotsTxt, '/admin/public/page');
      expect(resultAllowed.allowed).toBe(true);
    });

    it('should allow specific file in disallowed directory', () => {
      const robotsTxt = `
User-agent: *
Disallow: /private/
Allow: /private/public-file.html
`;
      const result = checkRobotsTxt(robotsTxt, '/private/public-file.html');
      expect(result.allowed).toBe(true);
    });
  });

  describe('Wildcard Path Matching', () => {
    it('should match * wildcard in path', () => {
      const robotsTxt = `
User-agent: *
Disallow: /search*
`;
      const result = checkRobotsTxt(robotsTxt, '/search?q=test');
      expect(result.allowed).toBe(false);
    });

    it('should match path ending with $ anchor', () => {
      const robotsTxt = `
User-agent: *
Disallow: /exact-page$
`;
      const resultExact = checkRobotsTxt(robotsTxt, '/exact-page');
      expect(resultExact.allowed).toBe(false);

      const resultExtended = checkRobotsTxt(robotsTxt, '/exact-page/more');
      expect(resultExtended.allowed).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle comments in robots.txt', () => {
      const robotsTxt = `
# This is a full-line comment
User-agent: * # inline comment after user-agent
Disallow: /blocked/ # this path is blocked
# Another comment
`;
      const result = checkRobotsTxt(robotsTxt, '/blocked/page');
      expect(result.allowed).toBe(false);
    });

    it('should handle multiple user-agent groups', () => {
      const robotsTxt = `
User-agent: Googlebot
Disallow: /google-only/

User-agent: *
Disallow: /blocked/

User-agent: AgentRank
Allow: /
`;
      const result = checkRobotsTxt(robotsTxt, '/blocked/page');
      expect(result.allowed).toBe(true); // AgentRank has Allow: /
    });

    it('should handle empty Disallow (allow all)', () => {
      const robotsTxt = `
User-agent: *
Disallow:
`;
      const result = checkRobotsTxt(robotsTxt, '/page');
      expect(result.allowed).toBe(true);
    });

    it('should handle malformed robots.txt gracefully', () => {
      const robotsTxt = `
This is not valid robots.txt format
Just some random text
`;
      const result = checkRobotsTxt(robotsTxt, '/page');
      expect(result.allowed).toBe(true); // No valid rules = allow
    });

    it('should handle case-insensitive user-agent matching', () => {
      const robotsTxt = `
User-agent: AGENTRANK
Disallow: /blocked/
`;
      const result = checkRobotsTxt(robotsTxt, '/blocked/page');
      expect(result.allowed).toBe(false);
    });

    it('should handle uppercase directives', () => {
      const robotsTxt = `
USER-AGENT: *
DISALLOW: /blocked/
`;
      const result = checkRobotsTxt(robotsTxt, '/blocked/page');
      expect(result.allowed).toBe(false);
    });

    it('should handle query strings in paths', () => {
      const robotsTxt = `
User-agent: *
Disallow: /search
`;
      // /search should block /search?q=foo
      const result = checkRobotsTxt(robotsTxt, '/search?q=foo');
      expect(result.allowed).toBe(false);
    });

    it('should handle robots.txt that is only comments', () => {
      const robotsTxt = `
# just
# some
# comments
`;
      const result = checkRobotsTxt(robotsTxt, '/page');
      expect(result.allowed).toBe(true);
    });

    it('should handle CRLF line endings', () => {
      const robotsTxt = 'User-agent: *\r\nDisallow: /blocked/';
      const result = checkRobotsTxt(robotsTxt, '/blocked/page');
      expect(result.allowed).toBe(false);
    });

    it('should allow when no matching user-agents found', () => {
      const robotsTxt = `
User-agent: OtherBot
Disallow: /
`;
      // AgentRank doesn't match OtherBot and there is no * wildcard
      const result = checkRobotsTxt(robotsTxt, '/page');
      expect(result.allowed).toBe(true);
    });
  });
});

describe('parseRobotsTxt', () => {
  it('should parse multiple user-agent groups', () => {
    const robotsTxt = `
User-agent: Googlebot
Disallow: /google-block/

User-agent: *
Disallow: /all-block/
`;
    const groups = parseRobotsTxt(robotsTxt);
    expect(groups.length).toBe(2);
    expect(groups[0]?.userAgents).toContain('Googlebot');
    expect(groups[1]?.userAgents).toContain('*');
  });

  it('should handle multiple user-agents for one group', () => {
    const robotsTxt = `
User-agent: Googlebot
User-agent: Bingbot
Disallow: /blocked/
`;
    const groups = parseRobotsTxt(robotsTxt);
    expect(groups.length).toBe(1);
    expect(groups[0]?.userAgents).toContain('Googlebot');
    expect(groups[0]?.userAgents).toContain('Bingbot');
  });

  it('should parse both Allow and Disallow rules', () => {
    const robotsTxt = `
User-agent: *
Disallow: /private/
Allow: /private/public/
`;
    const groups = parseRobotsTxt(robotsTxt);
    expect(groups[0]?.rules.length).toBe(2);
    expect(groups[0]?.rules[0]?.type).toBe('disallow');
    expect(groups[0]?.rules[1]?.type).toBe('allow');
  });
});

describe('RobotsBlockedError', () => {
  it('should create error with matched rule', () => {
    const error = new RobotsBlockedError('Disallow: /');
    expect(error.message).toContain('Disallow: /');
    expect(error.code).toBe('ROBOTS_BLOCKED');
    expect(error.matchedRule).toBe('Disallow: /');
    expect(error.name).toBe('RobotsBlockedError');
  });

  it('should create error without matched rule', () => {
    const error = new RobotsBlockedError();
    expect(error.message).toContain('robots.txt');
    expect(error.matchedRule).toBeUndefined();
  });
});
