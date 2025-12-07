# AgentRank.it

> **The PageSpeed Insights for the Agentic Web**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/agentrank.svg)](https://www.npmjs.com/package/agentrank)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)

AgentRank.it measures how reliably an AI agent can navigate your website. While Google PageSpeed Insights measures how fast a site loads for humans, we measure the **Agent Visibility Score** — a 0-100 rating of how well AI agents can understand and interact with your site.

**🌐 Try it live at [agentrank.it](https://agentrank.it)**

## 🚀 Quick Start

```bash
# Run directly with npx (no install required)
npx agentrank audit https://example.com

# Or install globally
npm install -g agentrank
agentrank audit https://example.com

# Or add to your project
npm install agentrank
```

### Programmatic Usage

```typescript
import { scanUrl } from 'agentrank';

const result = await scanUrl({ url: 'https://example.com' });
console.log(`Agent Score: ${result.agentScore}/100`);
```

## 📊 Agent Visibility Score

The score is composed of 5 weighted signals:

| Signal | Weight | What It Measures |
|--------|--------|------------------|
| **Permissions** | 20% | `robots.txt` analysis |
| **Structure** | 25% | Semantic HTML density (div soup detection) |
| **Accessibility** | 25% | Accessibility tree depth & ARIA labeling |
| **Hydration** | 15% | Time-to-Interactive for JS rendering |
| **Hostility** | 15% | Bot-blockers (CAPTCHA, Cloudflare, etc.) |

## 🏗️ Architecture: Two-Speed Design

AgentRank uses a **Reactive Escalation** architecture to balance cost and accuracy:

### Level 1: Speed Reader (Default)
- **Engine**: Playwright via Browser Use
- **Input**: Structured Accessibility Tree (text-only tokens)
- **Cost**: ~$0.002/scan
- **Speed**: <5 seconds

### Level 2: Visual Resolver (Deep Mode)
- **Trigger**: `--mode=deep` or interaction failures
- **Engine**: browser-use with Vision-LLM
- **Cost**: ~$0.02/scan
- **Speed**: 30-90 seconds

## 💻 CLI Usage

```bash
# Quick scan (default)
agentrank audit https://example.com

# Deep scan with Vision-LLM
agentrank audit https://example.com --mode deep

# JSON output
agentrank audit https://example.com --json

# Start MCP server for IDE integration
agentrank mcp --port 3000
```

## 📦 Advanced Programmatic Usage

```typescript
import { scanUrl, calculateScore, getGrade } from 'agentrank';

// Full options
const result = await scanUrl({
  url: 'https://example.com',
  mode: 'deep',           // 'quick' (default) or 'deep'
  timeout: 60000,         // Timeout in ms (default: 30000)
  skipEscalation: false,  // Skip visual fallback (default: false)
  verbose: true,          // Enable verbose logging
});

// Access individual signals
result.signals.permissions.status;  // 'pass' | 'warn' | 'fail'
result.signals.structure.score;     // 0-100
result.signals.accessibility.recommendations; // string[]

// Get grade
const grade = getGrade(result.agentScore); // 'A' | 'B' | 'C' | 'D' | 'F'
```

## 🔌 MCP Integration

AgentRank exposes an MCP server for IDE integration with Cursor and Claude Desktop:

```bash
agentrank mcp --port 3000
```

```json
POST /mcp
{
  "action": "audit",
  "url": "https://example.com",
  "mode": "quick"
}
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev -- audit https://example.com

# Run tests
npm test

# Type check
npm run typecheck
```

## 📁 Project Structure

```
src/
├── cli/              # CLI entry point (Commander.js)
├── core/
│   ├── scanner.ts    # Main scanner orchestrator
│   └── score.ts      # Score calculation
├── analyzers/        # Signal analyzers (5 modules)
├── engines/
│   ├── browser-use.ts       # Level 1: Playwright
│   └── browser-use-server.ts # Level 2: Vision fallback
├── mcp/              # MCP server for IDE integration
├── transcript/       # Think-Aloud narrative generator
└── types/            # TypeScript interfaces

apps/
└── web/              # Next.js web application (agentrank.it)
```

## �️ Roadmap

- [ ] **Switch to Azure OpenAI** — Migrate from OpenAI API to Azure OpenAI for enterprise-grade data privacy (ZDR by default)
- [ ] **Self-service account deletion** — Allow users to delete their account and all associated data
- [ ] **Respect robots.txt** — Read and enforce robots.txt directives; refuse to scan pages disallowed by robots.txt
- [ ] **Video retention policy** — Video recordings are retained for 90 days and then automatically deleted
- [ ] Privacy Policy page
- [ ] Terms of Service page
- [ ] GDPR compliance documentation

## �📜 License

Copyright 2025 Kiarash Adl

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.
