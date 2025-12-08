# agentrank

> **The PageSpeed Insights for the Agentic Web**

[![npm](https://img.shields.io/npm/v/agentrank.svg)](https://www.npmjs.com/package/agentrank)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green.svg)](https://nodejs.org/)

Measure how reliably an AI agent can navigate your website. Get an **Agent Visibility Score** (0-100) based on 5 signals: Permissions, Structure, Accessibility, Hydration, and Hostility.

**🌐 Try it live at [agentrank.it](https://agentrank.it)**

## Quick Start

```bash
# Run directly with npx
npx agentrank audit https://example.com

# Or install globally
npm install -g agentrank
agentrank audit https://example.com
```

## CLI Usage

```bash
# Quick scan (~5 seconds)
agentrank audit https://example.com

# Verbose output
agentrank audit https://example.com --verbose

# JSON output (for scripting)
agentrank audit https://example.com --json
```

## Programmatic Usage

```typescript
import { scanUrl, getGrade } from 'agentrank';

const result = await scanUrl({
  url: 'https://example.com',
  mode: 'quick',      // 'quick' (default) or 'deep'
  timeout: 30000,     // Timeout in ms
});

console.log(`Score: ${result.agentScore}/100`);
console.log(`Grade: ${getGrade(result.agentScore)}`); // A, B, C, D, or F

// Access individual signals
result.signals.permissions.status;  // 'pass' | 'warn' | 'fail'
result.signals.structure.score;     // 0-100
result.signals.accessibility.recommendations; // string[]
```

> **Note**: Deep mode (`mode: 'deep'`) requires a self-hosted browser-use engine. See [Deep Mode Setup](https://github.com/kiarashplusplus/AgentRank.it#-deep-mode-setup) for Docker configuration.

## Agent Visibility Score

| Signal | Weight | What It Measures |
|--------|--------|------------------|
| **Permissions** | 20% | `robots.txt` analysis |
| **Structure** | 25% | Semantic HTML density |
| **Accessibility** | 25% | ARIA labeling & accessibility tree |
| **Hydration** | 15% | Time-to-Interactive |
| **Hostility** | 15% | Bot-blockers (CAPTCHA, etc.) |

## MCP Server (IDE Integration)

Start a local MCP server for Cursor or Claude Desktop:

```bash
agentrank mcp --port 3000
```

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"action": "audit", "url": "https://example.com"}'
```

## Requirements

- Node.js 22+
- Playwright browsers (auto-installed on first run)

## Links

- **Website**: [agentrank.it](https://agentrank.it)
- **GitHub**: [github.com/kiarashplusplus/AgentRank.it](https://github.com/kiarashplusplus/AgentRank.it)
- **Issues**: [Report bugs](https://github.com/kiarashplusplus/AgentRank.it/issues)

## License

Apache-2.0 © [Kiarash Adl](https://github.com/kiarashplusplus)
