# Production Deployment Guide

This guide describes how to build, deploy, and maintain the AgentRank browser-use engine in a production environment.

## Prerequisites

- Docker and Docker Compose installed
- Access to LLM API keys (Azure OpenAI, OpenAI, or Anthropic)
- (Optional) Cloudflare R2 credentials for video storage

## Development Environment Setup

If you're developing in a dev container, GitHub Codespaces, or any Linux environment where Playwright isn't pre-configured:

### Install Playwright System Dependencies

Playwright requires system libraries for Chromium to run. Install them with:

```bash
npx playwright install-deps chromium
```

This installs required packages including:
- `libatk-1.0-0` (ATK accessibility toolkit)
- `libgbm1` (Generic Buffer Management)
- Font packages (`fonts-liberation`, `fonts-noto-color-emoji`, etc.)
- X11 and graphics libraries

### Fix Directory Permissions

The Docker container runs as UID 1000 (`appuser`). Ensure mounted volumes have correct ownership:

```bash
sudo chown -R 1000:1000 recordings engine-data
```

Without this, you may see `Permission denied` errors when the engine tries to save recordings.

## Environment Setup

1.  Create a `.env` file in the root directory (you can copy `.env.example`);
2.  Fill in the required environment variables:

    ```bash
    # LLM Settings (Recommended: Azure OpenAI)
    AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
    AZURE_OPENAI_API_KEY=your-key
    AZURE_OPENAI_DEPLOYMENT=gpt-4o
    
    # Or standard OpenAI
    OPENAI_API_KEY=sk-...
    
    # Storage (Optional)
    R2_ACCOUNT_ID=...
    R2_ACCESS_KEY=...
    R2_SECRET_KEY=...
    R2_PUBLIC_URL=...
    ```

## Building and Running

We use `docker-compose.prod.yml` for production deployments. This configuration:
- Builds the image securely with a non-root user.
- Sets strict restart policies and resource limits.
- Does *not* hot-reload code (code is baked into the image).

### 1. Build the Image

```bash
docker compose -f docker-compose.prod.yml build
```

### 2. Start the Service

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 3. Verify Deployment

Check the container status to ensure it is `healthy`:

```bash
docker compose -f docker-compose.prod.yml ps
```

View logs to confirm startup:

```bash
docker compose -f docker-compose.prod.yml logs -f
```

## Maintenance

### Updating Dependencies (requirements.lock)

To ensure reproducible builds, we use a `requirements.lock` file. When you need to add or update libraries:

1.  Add the library to `src/python-engine/requirements.txt`.
2.  Run the following command to generate a new lock file from within the container:

    ```bash
    docker compose -f docker-compose.prod.yml run --rm --entrypoint "pip freeze" engine > src/python-engine/requirements.lock
    ```
    
    *Note: This ensures dependencies are resolved in the exact Linux environment used for production.*

3.  Rebuild the image:
    
    ```bash
    docker compose -f docker-compose.prod.yml build
    ```

### Data Persistence

The following directories are mounted as volumes:
- `./engine-data`: General engine data.
- `./recordings`: Local video recordings (temporarily stored before upload).

Ensure the host user has read/write permissions for these directories, or that they are owned by UID 1000 (the container's `appuser`).

```bash
chown -R 1000:1000 ./recordings ./engine-data
```

## Troubleshooting

### Error: `libatk-1.0.so.0: cannot open shared object file`

**Cause:** Playwright's Chromium dependencies are not installed on the host system.

**Solution:** Install Playwright system dependencies:
```bash
npx playwright install-deps chromium
```

### Error: `Permission denied: '/app/recordings/...`

**Cause:** The Docker container (running as UID 1000) cannot write to the mounted volume.

**Solution:** Fix directory ownership:
```bash
sudo chown -R 1000:1000 recordings engine-data
```

### Browser fails to launch in container

**Cause:** Missing dependencies or insufficient permissions.

**Solution:** 
1. Verify Dockerfile includes `playwright install-deps chrome`
2. Ensure `--no-sandbox` flag is used in Chromium launch args (already configured)
3. Check container logs: `docker logs agentrank-engine`

## Azure Hosting Config

For production hosting on Azure, you need a container environment that matches the resource limits defined in our `docker-compose.prod.yml`.

**Recommended Specs:**
- **vCPU:** 2.0
- **Memory:** 4.0 GiB

### Option 1: Azure Container Apps (Recommended)
Best for production due to auto-scaling (including scale-to-zero to save costs) and built-in ingress.

- **Plan:** Consumption
- **Min Replicas:** 0 (if cost saving > latency) or 1 (for warm start)
- **Max Replicas:** As needed based on concurrent usage
- **Ingress:** Enabled, Target Port 8000

### Option 2: Azure Container Instances (ACI)
Best for simple, single-instance deployments without orchestration needs.

- **OS Type:** Linux
- **Restart Policy:** Always
- **Ports:** 8000 (TCP)
