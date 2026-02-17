#!/usr/bin/env bash
# Run on the server from DEPLOY_PATH. Expects FINTECH_IMAGE and .env (or env) to be set.
# Used by CI or manually: FINTECH_IMAGE=ghcr.io/owner/fintech:latest ./scripts/deploy.sh

set -e
set -o pipefail

error_exit() {
  echo "ERROR: $1" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$DEPLOY_PATH" || error_exit "Failed to cd to $DEPLOY_PATH"

if [ -z "$FINTECH_IMAGE" ]; then
  error_exit "FINTECH_IMAGE is not set (e.g. ghcr.io/owner/fintech:latest)"
fi

export FINTECH_IMAGE

echo "Pulling image: $FINTECH_IMAGE"
docker compose -f docker-compose.prod.yml pull api worker || error_exit "Failed to pull images"

echo "Starting services..."
docker compose -f docker-compose.prod.yml up -d api worker || error_exit "Failed to start services"

echo "Cleaning up old images..."
docker image prune -f || true

echo "Deploy finished. Check: docker compose -f docker-compose.prod.yml ps"
