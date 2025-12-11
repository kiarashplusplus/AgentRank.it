# Extraction Checklist

Use this checklist when extracting the AgentRank web app to a standalone repository.

## Pre-Extraction Preparation

### Code Verification
- [x] All monorepo dependencies removed or made configurable
- [x] No hardcoded paths to parent directories
- [x] Environment variables properly configured
- [x] TypeScript types self-contained
- [x] No imports from `../../dist/` or similar

### Documentation
- [x] README.standalone.md created
- [x] MIGRATION.md created
- [x] EXTRACTION_SUMMARY.md created
- [x] QUICKSTART.md created
- [x] env.example updated with all variables
- [x] Comments explain CLI configuration options

### Configuration Files
- [x] package.json updated with repository info
- [x] .gitignore updated for standalone repo
- [x] .dockerignore created
- [x] Dockerfile created
- [x] docker-compose.yml created
- [x] GitHub Actions workflows created

### Testing (Before Extraction)
- [ ] `npm install` succeeds
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run dev` starts successfully
- [ ] Quick scan works
- [ ] Deep scan works (if engine available)
- [ ] Database operations work

## Extraction Process

### 1. Create New Repository
- [ ] Create GitHub repository
- [ ] Set repository to public/private as needed
- [ ] Initialize with README (optional, will be replaced)
- [ ] Add .gitignore (optional, will be replaced)
- [ ] Choose Apache-2.0 license

### 2. Copy Files
```bash
# From monorepo root
cd /path/to/AgentRank.it
TARGET=/path/to/agentrank-web

# Copy all web app files
cp -r apps/web/* $TARGET/
cp -r apps/web/.* $TARGET/ 2>/dev/null || true

# Copy root-level files
cp LICENSE $TARGET/
cp CHANGELOG.md $TARGET/ # optional

# Rename README
cd $TARGET
mv README.standalone.md README.md
```

- [ ] All files copied successfully
- [ ] Hidden files (.gitignore, .env.example) copied
- [ ] LICENSE file present
- [ ] README.standalone.md renamed to README.md

### 3. Update Repository-Specific Files
- [ ] Verify package.json has correct repository URL
- [ ] Update any repository references if needed
- [ ] Check that .github/workflows point to correct repo

### 4. Initialize Git
```bash
cd /path/to/agentrank-web
git init
git add .
git commit -m "Initial commit: AgentRank web app extracted from monorepo"
git branch -M main
git remote add origin https://github.com/your-org/agentrank-web.git
git push -u origin main
```

- [ ] Git repository initialized
- [ ] Initial commit created
- [ ] Remote added
- [ ] Pushed to GitHub

## Post-Extraction Configuration

### 5. Set Up GitHub Repository

**Settings**
- [ ] Add repository description
- [ ] Add topics/tags (nextjs, web-app, agentrank, ai-agents)
- [ ] Configure branch protection for main
- [ ] Enable issues
- [ ] Enable discussions (optional)

**Secrets** (Settings → Secrets and variables → Actions)
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [ ] `CLERK_SECRET_KEY`
- [ ] `CLOUDFLARE_ACCOUNT_ID`
- [ ] `CLOUDFLARE_D1_DATABASE_ID`
- [ ] `CLOUDFLARE_API_TOKEN`
- [ ] `CRON_SECRET`

**Environment Variables** (for Cloudflare Pages)
- [ ] Configure all required env vars in Cloudflare dashboard
- [ ] Set `AGENTRANK_CLI_PATH=agentrank`

### 6. Local Development Setup
```bash
cd /path/to/agentrank-web
npm install
cp env.example .env.local
# Edit .env.local with your values
npm run db:push
npm run dev
```

- [ ] Dependencies installed successfully
- [ ] Environment configured
- [ ] Database initialized
- [ ] Dev server runs on http://localhost:3000

### 7. Test Standalone Functionality

**Basic Tests**
- [ ] Homepage loads
- [ ] Can submit a URL for scanning
- [ ] Quick scan completes successfully
- [ ] Results display correctly
- [ ] Can sign up/sign in
- [ ] Account page loads
- [ ] History page loads

**CLI Integration**
- [ ] AgentRank CLI accessible (`npx agentrank --version`)
- [ ] CLI path configured correctly in .env.local
- [ ] Scans execute via CLI
- [ ] JSON output parsed correctly

**Database Operations**
- [ ] Can save scan results
- [ ] Can retrieve history
- [ ] Credit system works
- [ ] User data persists

**Deep Mode** (if engine available)
- [ ] Engine starts: `docker-compose up -d engine`
- [ ] Deep scan option available
- [ ] Deep scan completes
- [ ] Visual diagnostics work

### 8. CI/CD Setup

**GitHub Actions**
- [ ] CI workflow runs on push
- [ ] Tests pass in CI
- [ ] Build completes in CI
- [ ] No secrets exposed in logs

**Deployment** (choose one)
- [ ] Cloudflare Pages configured
- [ ] Vercel configured
- [ ] Docker deployment configured
- [ ] Other hosting configured

### 9. Deploy to Production

**Pre-Deployment**
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] AgentRank CLI accessible in production

**Deploy**
- [ ] Initial deployment successful
- [ ] Production URL accessible
- [ ] Quick scan works in production
- [ ] Authentication works
- [ ] Database connections stable

**Post-Deployment**
- [ ] Monitor for errors
- [ ] Test all key features
- [ ] Verify analytics/monitoring
- [ ] Check performance

## Cleanup

### 10. Update Monorepo (Optional)
- [ ] Add note in monorepo README about web app extraction
- [ ] Link to new standalone repository
- [ ] Decide whether to keep apps/web in monorepo:
  - Option A: Remove it completely
  - Option B: Archive it (rename to apps/web-archived)
  - Option C: Keep for transition period

### 11. Documentation Updates
- [ ] Update main project documentation
- [ ] Add standalone repo to package.json homepage
- [ ] Update any external docs referencing the web app
- [ ] Announce extraction to users/community

## Verification

### Final Checks
- [ ] Standalone repo runs completely independently
- [ ] No references to monorepo structure
- [ ] All features work identically
- [ ] Documentation is clear and complete
- [ ] Deployment is successful
- [ ] CI/CD pipeline functioning
- [ ] Team can develop effectively

### Success Criteria
- [ ] Can clone fresh and run in < 5 minutes
- [ ] Contributors can set up dev environment easily
- [ ] Deployment is straightforward
- [ ] No dependency on monorepo
- [ ] All tests pass
- [ ] Production deployment stable

## Rollback Plan

If issues arise:

1. Keep monorepo intact (don't delete apps/web)
2. Revert environment variables to use monorepo paths
3. Continue using monorepo until issues resolved
4. The code is backward compatible

## Timeline

**Estimated Time for Extraction:**
- File copying: 5 minutes
- Git setup: 5 minutes  
- GitHub configuration: 10 minutes
- Local testing: 15 minutes
- CI/CD setup: 15 minutes
- Production deployment: 20 minutes
- **Total: ~70 minutes**

## Support

If you encounter issues:
- Review [MIGRATION.md](MIGRATION.md)
- Check [EXTRACTION_SUMMARY.md](EXTRACTION_SUMMARY.md)
- Consult [README.md](README.md)
- Open an issue on GitHub

## Notes

- Date extraction started: _______________
- Date extraction completed: _______________
- Repository URL: _______________
- Production URL: _______________
- Extracted by: _______________
- Issues encountered: _______________

---

**Status:** Ready for extraction ✅

All preparation work is complete. The web app is ready to be extracted into a standalone repository.
