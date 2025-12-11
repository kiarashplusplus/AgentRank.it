# Migration Guide: Extracting AgentRank Web to Standalone Repository

This guide explains how to extract the `apps/web` directory from the AgentRank monorepo into its own standalone repository.

## Overview

The AgentRank web application is being separated from the monorepo to:
- Enable independent deployment and versioning
- Simplify the web app development workflow
- Allow different teams to work on CLI and web independently
- Reduce deployment complexity

## Prerequisites

- Node.js 22+
- Git
- Access to create a new repository
- AgentRank CLI installed (globally or via npx)

## Step-by-Step Migration

### 1. Create New Repository

```bash
# Create a new repository on GitHub
# Name: agentrank-web (or your preferred name)

# Clone the new empty repository
git clone https://github.com/your-org/agentrank-web.git
cd agentrank-web
```

### 2. Copy Web App Files

From the monorepo, copy the entire `apps/web` directory to the new repository root:

```bash
# From the monorepo root
cd /path/to/AgentRank.it

# Copy all files from apps/web to the new repo
cp -r apps/web/* /path/to/agentrank-web/
cp apps/web/.gitignore /path/to/agentrank-web/
cp apps/web/.env.example /path/to/agentrank-web/ # if it exists
```

### 3. Copy Supporting Files

Copy necessary root-level files:

```bash
# Copy license and documentation
cp LICENSE /path/to/agentrank-web/
cp CHANGELOG.md /path/to/agentrank-web/ # optional

# Rename the standalone README
cd /path/to/agentrank-web
mv README.standalone.md README.md
```

### 4. Update Package.json

The `package.json` has already been updated with:
- Correct package name: `agentrank-web`
- Repository URLs
- License and author information
- Additional scripts for database management

Verify these changes are present.

### 5. Environment Configuration

Update your `.env.local` file:

```bash
cp env.example .env.local
```

Edit `.env.local` and configure:

```bash
# Required: Clerk authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
CLERK_SECRET_KEY=sk_test_YOUR_KEY_HERE

# Required: Cloudflare D1 database
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_D1_DATABASE_ID=your_database_id
CLOUDFLARE_API_TOKEN=your_api_token

# Required: AgentRank CLI path
# Option 1: Use npx (recommended)
AGENTRANK_CLI_PATH=agentrank

# Option 2: Use global install
# AGENTRANK_CLI_PATH=agentrank

# Option 3: Use custom path
# AGENTRANK_CLI_PATH=/path/to/agentrank/dist/cli/index.js

# Optional: Deep mode engine
ENGINE_URL=http://localhost:8001
```

### 6. Install Dependencies

```bash
cd /path/to/agentrank-web
npm install
```

### 7. Database Setup

Initialize your database:

```bash
# Push schema to Cloudflare D1
npm run db:push

# Or open Drizzle Studio to manage the database
npm run db:studio
```

### 8. Install AgentRank CLI

Choose one method:

**Option A: Global Install (Recommended)**
```bash
npm install -g agentrank
```

**Option B: Use npx (No Install)**
```bash
# No action needed - npx will download on first use
# Make sure AGENTRANK_CLI_PATH=agentrank in .env.local
```

**Option C: Local Development**
```bash
# Clone and build the CLI separately
git clone https://github.com/kiarashplusplus/AgentRank.it.git
cd AgentRank.it
npm install
npm run build

# Then set the path in .env.local
# AGENTRANK_CLI_PATH=/path/to/AgentRank.it/dist/cli/index.js
```

### 9. Test the Application

```bash
# Start development server
npm run dev

# Open http://localhost:3000
# Try running a quick scan to verify CLI integration
```

### 10. Commit and Push

```bash
cd /path/to/agentrank-web
git add .
git commit -m "Initial commit: AgentRank web app extracted from monorepo"
git push origin main
```

## Key Changes Made

### 1. Removed Monorepo Dependencies

**Before:**
```typescript
const cliPath = path.resolve(process.cwd(), "../../dist/cli/index.js");
```

**After:**
```typescript
const cliPath = process.env.AGENTRANK_CLI_PATH || "agentrank";
const isLocalPath = cliPath.includes("/") || cliPath.includes("\\");
const command = isLocalPath 
    ? `node "${path.resolve(cliPath)}" audit "${targetUrl}" --mode ${mode} --json`
    : `npx ${cliPath} audit "${targetUrl}" --mode ${mode} --json`;
```

### 2. Removed Core Package Import

**Before:**
```typescript
import type { DiagnosticTask } from '../../../../dist/core/diagnostic-prompts.js';
```

**After:**
```typescript
export interface DiagnosticTask {
    name: string;
    signal: string;
    icon: string;
    hint: string;
    prompt: string;
}
```

The `diagnosticTasks` array is now fully self-contained.

### 3. Updated Package Metadata

- Changed `name` from `"web"` to `"agentrank-web"`
- Added `description`, `author`, `license`
- Added `repository`, `bugs`, `homepage` URLs
- Added `keywords` for discoverability
- Added `engines` to specify Node.js version
- Added database management scripts

### 4. Enhanced Environment Configuration

Added `AGENTRANK_CLI_PATH` environment variable to configure CLI location, supporting:
- Global installs
- npx usage
- Custom local paths
- Monorepo compatibility (for transition period)

## Deployment

### Cloudflare Pages

1. Connect repository to Cloudflare Pages
2. Configure build settings:
   - Build command: `npm run build`
   - Output directory: `.next`
3. Add environment variables in dashboard
4. Deploy

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Docker

```bash
# Build image
docker build -t agentrank-web .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=... \
  -e CLERK_SECRET_KEY=... \
  -e CLOUDFLARE_ACCOUNT_ID=... \
  agentrank-web
```

## Troubleshooting

### CLI Not Found

**Error:** `agentrank: command not found`

**Solution:**
1. Install globally: `npm install -g agentrank`
2. Or use npx: Set `AGENTRANK_CLI_PATH=agentrank`
3. Or specify full path in `.env.local`

### Database Connection Failed

**Error:** Database connection errors

**Solution:**
1. Verify Cloudflare D1 credentials in `.env.local`
2. Check that database exists in Cloudflare dashboard
3. Run `npm run db:push` to initialize schema

### Deep Mode Not Available

**Error:** Deep scans fail or are not available

**Solution:**
1. Start the browser-use engine: `docker-compose up -d`
2. Set `ENGINE_URL=http://localhost:8001` in `.env.local`
3. Deep mode is optional - quick mode will still work

### Build Errors

**Error:** TypeScript or build errors

**Solution:**
1. Clear build cache: `rm -rf .next`
2. Reinstall dependencies: `rm -rf node_modules package-lock.json && npm install`
3. Check Node.js version: `node -v` (should be 22+)

## Maintaining Both Repositories

During the transition period, you may need to keep both repositories in sync.

### Syncing Changes from Monorepo to Standalone

```bash
# In monorepo
cd apps/web
git log --oneline -n 5  # Find recent commits

# In standalone repo
cd /path/to/agentrank-web
# Manually apply changes or cherry-pick commits
```

### Syncing Changes from Standalone to Monorepo

```bash
# In standalone repo
cd /path/to/agentrank-web
git log --oneline -n 5

# In monorepo
cd apps/web
# Manually apply changes
```

## Future Improvements

Consider these enhancements after migration:

1. **Independent Versioning**
   - Set up semantic versioning for web app releases
   - Tag releases independently from CLI

2. **CI/CD Pipeline**
   - Add GitHub Actions for automated testing
   - Set up automatic deployments to Cloudflare Pages

3. **API Versioning**
   - Version the API routes for better compatibility
   - Document API contract with OpenAPI/Swagger

4. **Monitoring**
   - Add error tracking (Sentry, etc.)
   - Set up analytics and performance monitoring

5. **Documentation Site**
   - Create dedicated docs for web app
   - Add API documentation

## Support

If you encounter issues during migration:

1. Check this guide first
2. Review the [README.md](README.md) for setup instructions
3. Open an issue on GitHub
4. Join our Discord community

## Rollback Plan

If you need to rollback to the monorepo setup:

1. Keep the monorepo intact during transition
2. Revert `.env.local` to use monorepo CLI path:
   ```bash
   AGENTRANK_CLI_PATH=../../dist/cli/index.js
   ```
3. The code is backward-compatible with monorepo structure

## License

This migration maintains the Apache-2.0 license from the original project.
