# Deployment (Docker + GHCR)

This project uses GitHub Actions to build a Docker image, push it to GitHub Container Registry (GHCR), and optionally deploy to a server via SSH.

## Pipeline overview

1. **Build** (on every push to `main`/`master`): Builds the app with Docker, pushes image to `ghcr.io/<owner>/<repo>:latest` and `ghcr.io/<owner>/<repo>:<sha>`.
2. **Deploy** (if server secrets are set): SSHs to the server, pulls the new image, and runs `docker compose -f docker-compose.prod.yml up -d api worker`.

## Local Docker (development)

```bash
docker compose up -d
# API: http://localhost:3000
# GraphQL: http://localhost:3000/graphql
```

## GitHub Actions setup

### Required for build and push (always)

- **GITHUB_TOKEN** is used automatically to push to GHCR. Ensure the workflow has `packages: write` (already set in `.github/workflows/deploy.yml`).

### Required for deploy (optional)

Add these repository secrets in **Settings → Secrets and variables → Actions**:

| Secret        | Description |
|---------------|-------------|
| `SERVER_HOST` | Server hostname or IP |
| `SERVER_USER` | SSH username |
| `SERVER_SSH_KEY` | Private SSH key (full content) for deployment |
| `SERVER_PORT` | (Optional) SSH port, default 22 |
| `DEPLOY_PATH` | (Optional) Path on server where repo or compose lives, default `/home/deploy/fintech` |
| `GHCR_PAT`    | (Optional) GitHub PAT with `read:packages` so the server can pull the image. Required if the GHCR package is private. |

If `SERVER_HOST` is not set, the workflow only builds and pushes the image (no deploy step).

## Server setup (first time)

1. **Install Docker and Docker Compose** on the server.

2. **Clone the repo** (or copy files) into the deploy path, e.g.:
   ```bash
   git clone https://github.com/<owner>/<repo>.git /home/deploy/fintech
   cd /home/deploy/fintech
   ```

3. **Create `.env`** in the deploy path with production values, e.g.:
   ```env
   FINTECH_IMAGE=ghcr.io/<owner>/<repo>:latest
   DATABASE_URL=postgresql://user:password@postgres:5432/offers_db
   POSTGRES_USER=offers_user
   POSTGRES_PASSWORD=<strong-password>
   POSTGRES_DB=offers_db
   API_PORT=3000
   ```
   For external Postgres/Redis, use your own `DATABASE_URL` and set `REDIS_HOST`/`REDIS_PORT`; you can then use a slimmer compose that only runs `api` and `worker`.

4. **GHCR login** (if the image is private): On the server, once per login session or via a token in CI:
   ```bash
   echo "$GHCR_PAT" | docker login ghcr.io -u <your-github-username> --password-stdin
   ```
   CI uses the `GHCR_PAT` secret to run this during deploy.

5. **Start full stack** (first time, or after changing compose/env):
   ```bash
   cd /home/deploy/fintech
   export FINTECH_IMAGE=ghcr.io/<owner>/<repo>:latest
   docker compose -f docker-compose.prod.yml up -d
   ```

Subsequent deploys are done by the workflow (pull + `up -d api worker`).

## Manual deploy on server

From the deploy path on the server:

```bash
export FINTECH_IMAGE=ghcr.io/<owner>/<repo>:latest
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

## Health check

The workflow hits `http://localhost:${API_PORT}/health` on the server after deploy. The app exposes `GET /health` for this and for load balancers.

## Files reference

- `.github/workflows/deploy.yml` – Build image, push to GHCR, SSH deploy and health check.
- `Dockerfile` – Multi-stage build; production runs `node dist/main`.
- `docker-compose.yml` – Local dev (builds image, postgres, redis, api, worker).
- `docker-compose.prod.yml` – Production (uses `FINTECH_IMAGE`, postgres, redis, api, worker).
- `scripts/deploy.sh` – Server-side script to pull and restart api/worker.
