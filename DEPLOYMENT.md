# AgentRank.it Deployment Guide

This guide covers deploying AgentRank.it with full Deep Mode (Skyvern) support.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     AgentRank.it                            │
├─────────────────────────────────────────────────────────────┤
│  CLI / Library (Node.js)                                    │
│  ├── Quick Mode: Playwright-based DOM analysis              │
│  └── Deep Mode: Skyvern Vision-LLM analysis                 │
├─────────────────────────────────────────────────────────────┤
│  Docker Services (for Deep Mode)                            │
│  ├── skyvern: Vision-LLM browser automation                 │
│  ├── postgres: Task persistence                             │
│  └── skyvern-ui: Web dashboard (optional)                   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
npm run build
```

### 2. Quick Mode (No Docker Required)

```bash
npx agentrank audit https://example.com
```

### 3. Deep Mode (Requires Docker)

```bash
# Start Skyvern services
docker-compose -f docker-compose.skyvern.yml up -d

# Get your API key from http://localhost:8081/settings
# Add it to .env:
echo "SKYVERN_API_KEY=your_jwt_key_here" >> .env

# Run deep audit
npx agentrank audit https://example.com --mode=deep
```

---

## Environment Variables

Create a `.env` file in the project root:

```bash
# Required for Deep Mode
SKYVERN_API_KEY=your_jwt_key_here

# Optional: Custom Skyvern endpoint (defaults to localhost:8000)
SKYVERN_API_ENDPOINT=http://localhost:8000/api/v1

# Required for Skyvern LLM (set in Docker)
OPENAI_API_KEY=sk-your-openai-key
```

---

## Docker Services

### Start All Services

```bash
docker-compose -f docker-compose.skyvern.yml up -d
```

### Service Ports

| Service | Port | Description |
|---------|------|-------------|
| `skyvern` | 8000 | Skyvern API |
| `skyvern-ui` | 8081 | Web Dashboard |
| `postgres` | 5432 (internal) | Database |

### Get Skyvern API Key

1. Open http://localhost:8081/settings
2. Copy the API key (JWT format)
3. Add to `.env`: `SKYVERN_API_KEY=<key>`

### View Logs

```bash
docker logs agentrank-skyvern -f
docker logs agentrank-postgres -f
```

### Stop Services

```bash
docker-compose -f docker-compose.skyvern.yml down
```

---

## CLI Usage

```bash
# Quick scan (Playwright only, ~5 seconds)
npx agentrank audit https://example.com

# Deep scan (Skyvern Vision-LLM, 30-120 seconds)
npx agentrank audit https://example.com --mode=deep

# JSON output
npx agentrank audit https://example.com --json

# Custom timeout (seconds)
npx agentrank audit https://example.com --timeout 60

# Start MCP server
npx agentrank mcp --port 3000
```

---

## Production Deployment

### Option A: Separate Services

| Component | Recommended Platform |
|-----------|---------------------|
| CLI/Library | npm package |
| Next.js Web | Vercel, Cloudflare Pages |
| Skyvern | Docker on VPS (needs GPU for speed) |
| PostgreSQL | Managed (Supabase, Neon, RDS) |

### Option B: Single Server (Docker Compose)

```bash
# On your VPS
git clone https://github.com/kiarashplusplus/AgentRank.it.git
cd AgentRank.it

# Set environment variables
cp .env.example .env
# Edit .env with your OPENAI_API_KEY

# Start everything
docker-compose -f docker-compose.skyvern.yml up -d
```

### Web App (Next.js)

The web app in `apps/web` requires additional setup:

```bash
cd apps/web
cp env.example .env.local
# Configure Clerk auth and Cloudflare D1
npm install
npm run dev
```

---

## Troubleshooting

### "Could not validate credentials"

- Ensure `SKYVERN_API_KEY` is set in `.env`
- Key should be a JWT (long string with dots)
- Restart the CLI after changing `.env`

### Skyvern container restarting

```bash
docker logs agentrank-skyvern
```

Common issues:
- Missing `OPENAI_API_KEY` in docker-compose
- PostgreSQL not ready (usually self-resolves)

### Task timeout

Deep scans take 30-120 seconds. Increase timeout:

```bash
npx agentrank audit https://example.com --mode=deep --timeout 180
```

### Port conflicts

Edit `docker-compose.skyvern.yml` to change ports:
```yaml
ports:
  - "8082:8080"  # Change left number
```

---

## Development

```bash
# Run in dev mode (hot reload)
npm run dev -- audit https://example.com

# Type check
npm run typecheck

# Run tests
npm test
```
