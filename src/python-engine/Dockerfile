FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
# Added tini for proper signal handling
RUN apt-get update && apt-get install -y \
  curl \
  git \
  ffmpeg \
  tini \
  && rm -rf /var/lib/apt/lists/*

# Create a non-root user with a fixed UID and home directory
# browser-use v0.10+ requires a writable home dir for config
RUN groupadd -r appuser && useradd -r -g appuser -u 1000 -m -d /home/appuser appuser

# Copy requirements and install Python dependencies
COPY requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock

# Install Playwright browsers and dependencies
# Playwright needs to install browsers; we do this as root, 
# but the cached binaries will be accessible.
RUN playwright install chromium
RUN playwright install-deps chromium

# Copy application code
COPY . .

# Set ownership of the application directory to the non-root user
# Needed for recording video files
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health Check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Use tini as entrypoint
ENTRYPOINT ["/usr/bin/tini", "--"]

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
