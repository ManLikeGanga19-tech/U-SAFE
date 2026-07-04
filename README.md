# U-SAFE KE

Enterprise PPE / safety-equipment commerce platform for **U-SAFE KE** (Nairobi).
Commercial storefront + admin control plane over a Python API.

- **Architecture:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Design system (design law):** [THEME.md](THEME.md)

## Stack

| Part | Tech | Deploy target |
|---|---|---|
| Storefront (`apps/web`) | Next.js 15, TS, Tailwind (no-radius) | Vercel → `u-safe.co.ke` |
| Admin (`apps/admin`) | Next.js 15, TS | Vercel → `admin.u-safe.co.ke` |
| API (`services/api`) | FastAPI, SQLAlchemy 2, Alembic | Render → `api.u-safe.co.ke` |
| Worker | ARQ (same image) | Render |
| Database | PostgreSQL 16 | Render Postgres |
| Cache/queue | Redis | Render Key Value |
| Object storage | S3 API — MinIO (dev) / Cloudflare R2 (prod) | — |

Everything is Docker-first so the "Render now → VPS later" migration is a config change.

## Run locally (all in Docker)

Prereqs: Docker Desktop.

```bash
cp .env.example .env          # then set JWT_SECRET
docker compose -f infra/docker-compose.dev.yml --env-file .env up -d --build
```

| Service | URL |
|---|---|
| Storefront | http://localhost:3000 |
| Admin | http://localhost:3001 |
| API docs (Swagger) | http://localhost:8080/docs |
| API health | http://localhost:8080/api/v1/health |
| MinIO console | http://localhost:9003 |

**Seed admin login:** `admin@u-safe.co.ke` / `ChangeMe123!` (from `.env`).

The API container auto-applies migrations and seeds baseline data (admin, 12 PPE
categories, 19 brands, demo products) on start.

### IDE setup (important)

The app runs entirely in Docker, so `node_modules` live in container volumes — the
host copies start empty and your editor's TypeScript server can't resolve `react`,
`next`, etc. Run one host-side install so the IDE sees the types:

```bash
corepack pnpm@9.15.9 install     # populates host node_modules for the editor
```

This is independent of Docker and doesn't affect the running containers.

### Useful

```bash
# logs
docker compose -f infra/docker-compose.dev.yml logs -f api web

# create a new migration after changing models
docker compose -f infra/docker-compose.dev.yml exec api \
  alembic revision --autogenerate -m "your change"
docker compose -f infra/docker-compose.dev.yml exec api alembic upgrade head

# stop
docker compose -f infra/docker-compose.dev.yml down
```

## Layout

```
apps/web        Next.js storefront
apps/admin      Next.js admin control plane
services/api    FastAPI backend (models, auth, catalog, migrations, seed)
packages/config Shared Tailwind preset + design tokens (no-radius enforced)
infra/          docker-compose.dev.yml, render.yaml, frontend dev Dockerfile
```

## Ports

Host ports are offset (5433/6381/8080/9002-3) to avoid clashes with other local
stacks. Change them in `.env`.
