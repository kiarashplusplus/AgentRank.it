# AgentRank.it Dashboard

Next.js 15 dashboard for the AgentRank.it Agent Visibility Score platform.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Clerk authentication:**
   - Create a Clerk account at https://dashboard.clerk.com
   - Create a new application
   - Copy your API keys to `.env.local`:
   ```bash
   cp env.example .env.local
   # Edit .env.local with your Clerk keys
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |

## Stack

- **Framework:** Next.js 15 (App Router)
- **UI:** shadcn/ui + Tailwind CSS
- **Auth:** Clerk
- **Charts:** Recharts

## Components

- `ScoreGauge` - Radial chart for Agent Visibility Score (0-100)
- `SignalCards` - 5-signal breakdown cards
- `TranscriptChat` - Think-Aloud log display
- `HistoryChart` - Score trend visualization
- `UrlInput` - Domain input form
- `Header` - Navigation with auth controls
