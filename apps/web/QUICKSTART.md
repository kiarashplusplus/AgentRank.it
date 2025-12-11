# Quick Start Guide

Get the AgentRank web app running locally in 5 minutes.

## Prerequisites

- Node.js 22+ installed
- npm or pnpm
- Git

## Steps

### 1. Clone Repository

```bash
git clone https://github.com/kiarashplusplus/agentrank-web.git
cd agentrank-web
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment

```bash
cp env.example .env.local
```

Edit `.env.local` with your credentials:

```bash
# Minimum required for local development:

# Clerk (get free account at https://clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Cloudflare D1 (get free account at https://cloudflare.com)
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_D1_DATABASE_ID=your_database_id
CLOUDFLARE_API_TOKEN=your_api_token

# AgentRank CLI (use npx, no install needed)
AGENTRANK_CLI_PATH=agentrank
```

### 4. Initialize Database

```bash
npm run db:push
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

## Testing the App

1. Visit http://localhost:3000
2. Try a quick scan with a URL like `https://example.com`
3. Sign up to test authenticated features
4. View your scan history

## Optional: Enable Deep Mode

Deep mode requires the browser-use engine:

```bash
# Start the engine
docker-compose up -d engine

# Add to .env.local
ENGINE_URL=http://localhost:8001
```

## Troubleshooting

### "agentrank: command not found"

Install the CLI:
```bash
npm install -g agentrank
```

### Database Connection Error

Verify your Cloudflare D1 credentials:
1. Go to https://dash.cloudflare.com
2. Navigate to Workers & Pages → D1
3. Copy your database credentials
4. Update `.env.local`

### Port 3000 Already in Use

Change the port:
```bash
PORT=3001 npm run dev
```

### Build Errors

Clear cache and reinstall:
```bash
rm -rf .next node_modules package-lock.json
npm install
npm run dev
```

## Next Steps

- Read [README.md](README.md) for detailed documentation
- Check [MIGRATION.md](MIGRATION.md) if extracting from monorepo
- Review [EXTRACTION_SUMMARY.md](EXTRACTION_SUMMARY.md) for architecture details
- Set up deployment following the README

## Need Help?

- Documentation: https://agentrank.it/docs
- Issues: https://github.com/kiarashplusplus/agentrank-web/issues
- Discord: https://discord.gg/agentrank

## Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm start            # Run production build
npm run lint         # Run ESLint
npm test             # Run tests
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio
```

Enjoy building with AgentRank! 🚀
