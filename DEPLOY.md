# Deployment — Render (backend) + Vercel (frontends)

Deploy order: **R2 → Render (API) → Vercel (web + admin) → wire CORS/callback → verify**.
Domains come last (see the end). All of this uses the default `*.onrender.com` /
`*.vercel.app` URLs first; nothing needs `u-safe.co.ke` yet.

---

## 0. Prerequisites
- Repo on GitHub ✅
- A Daraja app (Consumer Key/Secret/Passkey) — sandbox is fine to start.
- A Cloudflare account (free) for R2 object storage (product images, PDFs).

---

## 1. Cloudflare R2 (media storage)
MinIO is local-only; production uploads go to R2 (S3-compatible — no code change).

1. Cloudflare dashboard → **R2** → **Create bucket** → name e.g. `usafe-media`.
2. Bucket → **Settings** → **Public access** → enable the **r2.dev** public URL
   (or attach a custom domain later). Copy the public base URL, e.g.
   `https://pub-xxxxxxxx.r2.dev`.
3. R2 → **Manage API Tokens** → **Create API token** (Object Read & Write) →
   copy the **Access Key ID**, **Secret Access Key**, and the **S3 API endpoint**
   (`https://<accountid>.r2.cloudflarestorage.com`).

Keep these for Render:
| Render var | Value |
|---|---|
| `S3_ENDPOINT` | `https://<accountid>.r2.cloudflarestorage.com` |
| `S3_PUBLIC_ENDPOINT` | `https://pub-xxxxxxxx.r2.dev` |
| `S3_ACCESS_KEY` | R2 Access Key ID |
| `S3_SECRET_KEY` | R2 Secret Access Key |
| `S3_BUCKET` | `usafe-media` |
| `S3_REGION` | `auto` |

> The storefront still shows category & hero images without R2 (they ship in the
> Vercel build). R2 is needed for **admin-uploaded** product images, brand logos
> and quote PDFs.

---

## 2. Render — API + worker + Postgres + Redis
1. Render → **New +** → **Blueprint** → connect the GitHub repo. `render.yaml`
   lives at the **repo root** (Blueprint Path can stay the default `render.yaml`).
   Render proposes: `usafe-api` (web), `usafe-worker`, `usafe-redis` (Key Value),
   `usafe-db` (Postgres).
   > If Render says *"render.yaml not found on main"*, the file just isn't pushed
   > yet — commit/push and retry.
2. **Apply**. Then open **usafe-api → Environment** and fill the `sync:false` vars:

| Var | Value |
|---|---|
| `FIRST_ADMIN_PASSWORD` | a strong admin password |
| `CORS_ORIGINS` | *(leave blank for now — set after Vercel, step 4)* |
| `S3_*` | the six R2 values from step 1 |
| `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` / `MPESA_PASSKEY` | your Daraja creds |
| `MPESA_CALLBACK_URL` | `https://<your-api>.onrender.com/api/v1/payments/mpesa/callback` |

   `JWT_SECRET` is auto-generated; DB + `REDIS_URL` are wired automatically.
3. The API boots, **runs migrations + seeds** (admin user, 12 categories, 19 brands,
   demo products) automatically. Watch **Logs** for `Application startup complete`.
4. Note the API URL, e.g. `https://usafe-api.onrender.com`. Check
   `https://usafe-api.onrender.com/api/v1/health` → `{"status":"ok"}`.

> Free/starter Postgres + Key Value are fine to start; upgrade later.

---

## 3. Vercel — storefront + admin (two projects)
Import the **same repo twice** (once per app).

**Storefront (`usafe-web`)**
1. Vercel → **Add New → Project** → import the repo.
2. **Root Directory** → `apps/web`. Framework preset: **Next.js** (auto).
   Vercel detects the pnpm workspace and installs from the repo root.
3. **Environment Variables**:
   | Var | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://usafe-api.onrender.com` |
   | `API_INTERNAL_URL` | `https://usafe-api.onrender.com` |
4. **Deploy** → note the URL, e.g. `https://usafe-web.vercel.app`.

**Admin (`usafe-admin`)**
1. Add New → Project → same repo → **Root Directory** → `apps/admin`.
2. **Environment Variables**:
   | Var | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://usafe-api.onrender.com` |
3. Deploy → note the URL, e.g. `https://usafe-admin.vercel.app`.

---

## 4. Wire them together
1. **Render → usafe-api → Environment → `CORS_ORIGINS`** =
   `https://usafe-web.vercel.app,https://usafe-admin.vercel.app`
   → **Save** (the API redeploys).
2. Confirm `MPESA_CALLBACK_URL` points at the Render API URL, and set that same URL
   as the callback in the **Daraja portal** for your app.

---

## 4b. CI/CD — automated deploys (GitHub Actions)

### Branch strategy (keeps bugs out of production)
```
feature/* ──PR──▶ develop ──(auto)──▶ STAGING
                     │
                     └──PR──▶ main ──(auto)──▶ PRODUCTION
```
- All work happens on `develop` (or feature branches → PR into `develop`).
- Push to **`develop`** → CI runs, then deploys to **staging**.
- Promote by PR **`develop` → `main`**; on merge, CI runs, then deploys to **production**.
- **Pull requests run the build/typecheck gates only** — no deploy.

The pipeline (`.github/workflows/ci.yml`) always: **build + typecheck web/admin → build
the API image → (only if green) deploy**, then a **post-deploy smoke test** polls the API's
`/health` and confirms it reports the *new* commit SHA (via Render's `RENDER_GIT_COMMIT`).
If the new version doesn't come up healthy, the run fails.

> One-time provisioning (steps 1–4) still happens once per environment in the dashboards
> (that does the first deploy). After that, deploys are automatic.

### Setup
**a) Native auto-deploy off** (pipeline is the only deployer — no double builds):
- Render: handled by `render.yaml` (`autoDeploy: false`).
- Vercel: each project → **Settings → Git** → turn off automatic production deployments.

**b) Create deploy hooks** (Render: service → **Settings → Deploy Hook**; Vercel: project →
**Settings → Git → Deploy Hooks**, branch = that env's branch).

**c) GitHub → Settings → Environments** → create **`production`** and **`staging`**.
On `production`, optionally add a **Required reviewer** → then every prod deploy waits for
your manual approval (a hard gate against bad releases).

**d) Add secrets + variables** (repo or per-environment, Settings → Secrets and variables → Actions):

| Production secret | Value |
|---|---|
| `RENDER_DEPLOY_HOOK_API` | Render prod API hook |
| `RENDER_DEPLOY_HOOK_WORKER` | Render prod worker hook |
| `VERCEL_DEPLOY_HOOK_WEB` | Vercel prod web hook |
| `VERCEL_DEPLOY_HOOK_ADMIN` | Vercel prod admin hook |

| Staging secret | Value |
|---|---|
| `STAGING_RENDER_DEPLOY_HOOK_API` / `..._WORKER` | Render staging hooks |
| `STAGING_VERCEL_DEPLOY_HOOK_WEB` / `..._ADMIN` | Vercel staging hooks |

| Variable (public) | Value |
|---|---|
| `PROD_API_URL` | `https://usafe-api.onrender.com` (prod API base) |
| `STAGING_API_URL` | staging API base |

Staging is optional to start — if the staging secrets/vars aren't set, that job just skips
its steps. Production works with only the four production secrets + `PROD_API_URL`.

Done — `git push` to `develop` ships staging, PR-merge to `main` ships production, both gated
by CI and verified by the health check.

---

## 5. Verify (production smoke test)
- Storefront loads at the Vercel URL; categories/hero render.
- Admin: sign in at the admin Vercel URL with `admin@u-safe.co.ke` + your
  `FIRST_ADMIN_PASSWORD`.
- Admin → Products → upload an image (proves R2 works).
- Storefront → add to cart → checkout with a real Safaricom number → STK prompt →
  order flips to **paid** (Daraja posts to the Render callback — no tunnel needed).

---

## 6. Custom domains (do last)
When ready to propagate `u-safe.co.ke`:
1. **Vercel**: add domain `u-safe.co.ke` to `usafe-web`, `admin.u-safe.co.ke` to
   `usafe-admin` (Vercel shows the DNS records to add).
2. **Render**: usafe-api → Settings → Custom Domain → `api.u-safe.co.ke` (add the CNAME).
3. Update env to the real domains and redeploy:
   - Render `CORS_ORIGINS` = `https://u-safe.co.ke,https://admin.u-safe.co.ke`
   - Render `MPESA_CALLBACK_URL` = `https://api.u-safe.co.ke/api/v1/payments/mpesa/callback`
     (and update it in the Daraja portal)
   - Vercel (both apps) `NEXT_PUBLIC_API_URL` / `API_INTERNAL_URL` = `https://api.u-safe.co.ke`

---

## Notes
- **Migrations** run automatically on every API deploy (`RUN_MIGRATIONS=1`, Alembic
  `upgrade head` in the entrypoint) — new migrations apply on push.
- **Render free web services sleep** after inactivity (cold starts). Upgrade the
  `usafe-api` plan for always-on before launch.
- Line endings are pinned to LF via `.gitattributes` so the Docker entrypoint runs
  on Render's Linux builders.
