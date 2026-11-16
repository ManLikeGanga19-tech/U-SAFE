# Deployment — VPS (backend) + Vercel (frontends)

The U-SAFE backend (API + ARQ worker + Postgres + Redis) runs on a **Contabo VPS**
in Docker Compose. The storefront and admin stay on **Vercel**. Media (images,
PDFs) is stored **on the VPS** and served by the API. This replaces the old Render
+ Cloudflare R2 setup (see `DEPLOY.md` history).

The VPS is **shared** with other projects (ShuleHQ, Wooden Houses, wifios). U-SAFE is
deliberately walled off so it cannot affect them — read §4 before touching the edge.

---

## 0. Topology

```
Internet ──▶ sms-caddy (ShuleHQ edge, :80/:443, the ONLY public web server)
                │  (TLS + host-based routing)
                ├─ api.u-safe.co.ke ──▶ usafe-prod-api:8000   ← us
                ├─ *.shulehq.co.ke  ──▶ sms-nginx
                └─ *.woodenhouseskenya.com ──▶ woodenhouses-*
```

U-SAFE publishes **no host ports**. The edge reaches `usafe-prod-api` over a private
Docker network (`usafe-edge-net`) that the edge is attached to.

| Thing | Value |
|---|---|
| Host | `94.72.102.13` (user `deploy`, SSH keys only, root login off) |
| App dir | `~/usafe` (repo files: `services/api`, `infra/`) |
| Secrets | `~/usafe/prod.env` (mode 600, **not** in git) |
| Compose | `infra/docker-compose.prod.yml` (project `usafe-prod`) |
| API URL | `https://api.u-safe.co.ke` (TLS via Let's Encrypt HTTP-01) |

---

## 1. Media (stored on the VPS)
Product photos, brand logos and quote PDFs are stored in the Docker volume
`usafe-prod-media` (mounted at `/data/media` in the API) and served by the API at
`https://api.u-safe.co.ke/media/<folder>/<uuid>.<ext>` with year-long immutable
cache headers. Nothing to configure: `STORAGE_BACKEND=local` is set in
`docker-compose.prod.yml`. No extra DNS, Caddy block or container.

Uploaded photos are auto-rotated, stripped of metadata (incl. phone GPS), shrunk
to max 1600px and saved as WebP, so files stay small (typically 100–300 KB).

Check: `curl -s https://api.u-safe.co.ke/api/v1/health` shows `"media_storage":"ok"`.
Disk use: `docker system df -v | grep usafe-prod-media`.

### Backups (media + database)
Everything now lives on this one box, so run `infra/backup.sh` nightly (instructions
at the top of the script: one crontab line, no root). It keeps 14 days of
`pg_dump` + media tarballs in `~/usafe-backups`. **Also copy that folder off the
VPS regularly**; a disk failure takes local backups with it:
```bash
rsync -az deploy@94.72.102.13:usafe-backups/ ./usafe-backups/
```
Restore: `docker exec -i usafe-prod-postgres pg_restore -U usafe -d usafe --clean < db-….dump`
and `docker run --rm -i -v usafe-prod-media:/media alpine tar xzf - -C /media < media-….tgz`.

---

## 2. First-time provisioning on the VPS

```bash
# as deploy@94.72.102.13
mkdir -p ~/usafe
# (code is delivered by CI rsync, or scp services/api + infra manually)
cp infra/prod.env.example ~/usafe/prod.env   # then fill it in
chmod 600 ~/usafe/prod.env

# U-SAFE's own edge network (once)
docker network create usafe-edge-net

# build + start
cd ~/usafe
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo manual) \
  docker compose -f infra/docker-compose.prod.yml up -d --build
```

The API entrypoint waits for Postgres, runs `alembic upgrade head`, seeds the admin
+ categories + brands, then starts uvicorn. Watch `docker logs usafe-prod-api`.

Verify (from the box):
```bash
docker exec usafe-prod-api curl -s localhost:8000/api/v1/health   # {"status":"ok",...}
```

---

## 3. Wire the edge (one-time, see §4 for the guard)

```bash
# 1. attach the edge to our network (non-disruptive, no restart)
docker network connect usafe-edge-net sms-caddy

# 2. site block — kept outside /opt/shulehq so ShuleHQ deploys can't delete it
#    content is in the repo at infra/caddy/usafe-caddy-block.txt
cp infra/caddy/usafe-caddy-block.txt /opt/caddy-sites/usafe.caddy

# 3. append to the edge Caddyfile, validate, then reload (never reload if invalid)
cp /opt/shulehq/Caddyfile /opt/shulehq/Caddyfile.bak.$(date -u +%F-%H%M%S)
cat /opt/caddy-sites/usafe.caddy >> /opt/shulehq/Caddyfile
docker exec sms-caddy caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile \
  && docker exec sms-caddy caddy reload --adapter caddyfile --config /etc/caddy/Caddyfile
```

DNS: at HostAfrica add `A  api → 94.72.102.13`. Caddy issues the cert on first
request (HTTP-01). **No Cloudflare / DNS-01** — u-safe.co.ke DNS is at HostAfrica.

---

## 4. Co-tenancy rules — DO NOT BREAK THE OTHER PROJECTS

1. **Never** run in `~/wifios` or `/opt/shulehq`: `docker compose down`, `system prune`,
   `volume prune`, or edits to their `.env`.
2. The edge (`sms-caddy`) is ShuleHQ's and fronts every site. Only ever **append** a
   block and only reload after `caddy validate` passes. Keep the timestamped backup.
3. U-SAFE stays in its own folder / compose project / network / volumes, publishes **no
   ports**, and has per-container `mem_limit`.
4. **ShuleHQ deploys overwrite `/opt/shulehq/Caddyfile`**, wiping appended blocks and the
   edge's extra network attachments. A self-healing guard restores ours:
   - `/opt/caddy-sites/usafe-guard.sh` — re-appends the block + re-attaches the network,
     then validate+reload. Idempotent; safe beside the Wooden Houses guard.
   - systemd `usafe-edge-guard.path` (watches the Caddyfile) + `.timer` (60s safety net)
     → `.service` (runs the script as `deploy`).
   - Check it: `tail /opt/caddy-sites/usafe-guard.log`, `systemctl status usafe-edge-guard.path`.

---

## 5. Routine deploys

Automatic via GitHub Actions (`.github/workflows/ci.yml`): push to **main** →
build/typecheck gates → rsync code to `~/usafe` → `docker compose up -d --build` →
smoke-test `/health` reports the new commit SHA. Manual run: Actions → CI/CD → Run.

Manual from a laptop with `deploy` SSH access:
```bash
tar czf - services/api infra | ssh deploy@94.72.102.13 'tar xzf - -C ~/usafe'
ssh deploy@94.72.102.13 'cd ~/usafe && GIT_COMMIT=$(date +%s) \
  docker compose -f infra/docker-compose.prod.yml up -d --build'
```

Migrations run automatically on API boot. Rollback: redeploy an older commit (a
migration that dropped a column won't roll back — back up first for destructive ones).

---

## 6. Vercel (frontends) — unchanged except the API URL
Both `usafe-web` and `usafe-admin` projects:
- `NEXT_PUBLIC_API_URL` = `https://api.u-safe.co.ke`
- web also: `API_INTERNAL_URL` = `https://api.u-safe.co.ke`

---

## 7. M-Pesa
Set the Daraja STK callback to
`https://api.u-safe.co.ke/api/v1/payments/mpesa/callback` (portal + `prod.env`).
