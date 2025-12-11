# AgentRank.it Web Application

The web interface for [AgentRank.it](https://agentrank.it) - The Page Speed for the Agentic Web.

## Overview

This is a Next.js application that provides a web interface for analyzing websites with the AgentRank scoring system. It measures how reliably AI agents can navigate your website through a 0-100 Agent Visibility Score.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Runtime**: React 19
- **Database**: Turso (LibSQL) via Drizzle ORM
- **Authentication**: Clerk
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI + shadcn/ui
- **Charts**: Recharts
- **Deployment**: Cloudflare Pages (recommended)

## Prerequisites

- Node.js 22+
- npm or pnpm
- A Turso database instance
- Clerk account for authentication
- AgentRank CLI installed (for running audits)

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/agentrank-web.git
cd agentrank-web
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Copy the example environment file and fill in your values:

```bash
cp env.example .env.local
```

Required environment variables:
- `DATABASE_URL` - Your Turso database URL
- `DATABASE_AUTH_TOKEN` - Your Turso auth token
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `CLERK_SECRET_KEY` - Clerk secret key
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` - Sign in URL path
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL` - Sign up URL path

See `env.example` for a complete list.

### 4. Database Setup

Run the Drizzle migrations:

```bash
npm run db:push
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
apps/web/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── api/          # API routes
│   │   ├── account/      # Account management page
│   │   ├── history/      # Audit history page
│   │   └── task/         # Task detail page
│   ├── components/       # React components
│   │   └── ui/          # shadcn/ui components
│   ├── db/              # Database schema and client
│   ├── lib/             # Utility functions
│   └── types/           # TypeScript type definitions
├── drizzle/             # Database migrations
├── public/              # Static assets
└── drizzle.config.ts    # Drizzle ORM configuration
```

## Key Features

### Quick Scan
Fast, free scanning that analyzes:
- robots.txt permissions
- HTML structure and semantic elements
- Accessibility features
- Page load and hydration
- Bot-blocking measures

### Deep Scan (Premium)
Advanced visual analysis using browser automation:
- AI-powered page interaction testing
- Visual element detection
- Advanced hostility detection
- Detailed diagnostic reports

### Credit System
- Anonymous users: 3 free quick scans per 24 hours
- Authenticated users: Credit-based system
- Quick scan: 1 credit
- Deep scan: 10 credits

## Dependencies on AgentRank CLI

**Important**: This web app requires the AgentRank CLI to be installed and accessible to run audits.

The API routes execute the CLI command:
```bash
npx agentrank audit <url> --mode <quick|deep> --json
```

### For Monorepo Setup
The app expects the CLI at `../../dist/cli/index.js` relative to the web app root.

### For Standalone Setup
You need to either:
1. Install `agentrank` globally: `npm install -g agentrank`
2. Modify the API route to use `npx agentrank` instead of a local path
3. Deploy with the CLI included in your build

See `MIGRATION.md` for details on decoupling from the CLI.

## API Routes

### `POST /api/audit`
Run an AgentRank audit on a URL.

**Request Body:**
```json
{
  "url": "https://example.com",
  "mode": "quick" | "deep"
}
```

**Response:**
```json
{
  "url": "https://example.com",
  "agentScore": 85,
  "mode": "quick",
  "signals": [...],
  "creditsRemaining": 10,
  "tier": "free"
}
```

### `GET /api/history`
Get audit history for authenticated user.

### `GET /api/history/all`
Get all audit history with pagination.

## Database Schema

The app uses the following main tables:
- `users` - User profiles and credit balances
- `audit_history` - Historical audit results
- `credit_transactions` - Credit usage tracking

See `src/db/schema.ts` for the complete schema.

## Deployment

### Cloudflare Pages (Recommended)

1. Connect your repository to Cloudflare Pages
2. Build command: `npm run build`
3. Output directory: `.next`
4. Add environment variables in Cloudflare dashboard
5. Enable Cloudflare Workers for API routes

### Vercel

```bash
vercel --prod
```

### Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode

### Code Quality

The project uses:
- ESLint for linting
- TypeScript for type checking
- Vitest for testing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

Apache-2.0 - See LICENSE file for details

## Support

- Documentation: [agentrank.it/docs](https://agentrank.it/docs)
- Issues: [GitHub Issues](https://github.com/your-org/agentrank-web/issues)
- Discord: [Join our community](https://discord.gg/agentrank)

## Acknowledgments

Built with:
- [Next.js](https://nextjs.org/)
- [Clerk](https://clerk.com/)
- [Turso](https://turso.tech/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [shadcn/ui](https://ui.shadcn.com/)
