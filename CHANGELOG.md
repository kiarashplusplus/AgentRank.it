# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-12-08

### Added

- **CLI Tool**: `agentrank audit <url>` command for scanning websites
- **Agent Visibility Score**: 0-100 composite score from 5 weighted signals
  - Permissions (20%): robots.txt / ai.txt analysis
  - Structure (25%): Semantic HTML density detection
  - Accessibility (25%): ARIA labeling and accessibility tree analysis
  - Hydration (15%): Time-to-Interactive measurement
  - Hostility (15%): Bot-blocker and CAPTCHA detection
- **Two-Speed Architecture**:
  - Level 1 (Quick): Playwright-based DOM analysis (~5s, $0.002/scan)
  - Level 2 (Deep): Vision-LLM analysis via browser-use (~60s, $0.02/scan)
- **MCP Server**: IDE integration endpoint for Cursor and Claude Desktop
- **Programmatic API**: `scanUrl()` function for library usage
- **Think-Aloud Narrative**: Human-readable transcript of agent navigation
- **Actionable Recommendations**: Per-signal improvement suggestions

### Technical

- Node.js 22+ ESM package
- TypeScript 5.7 with strict mode
- Playwright 1.49 for browser automation
- Full test suite (40 tests passing)

[0.1.0]: https://github.com/kiarashplusplus/AgentRank.it/releases/tag/v0.1.0
