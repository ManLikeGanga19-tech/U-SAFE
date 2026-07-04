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
1. Render → **New +** → **Blueprint** → connect the GitHub repo. Render reads
   `infra/render.yaml` and proposes: `usafe-api` (web), `usafe-worker`,
   `usafe-redis` (Key Value), `usafe-db` (Postgres).
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
The pipeline in `.github/workflows/ci.yml` runs on every push to `main`:
**build + typecheck web/admin → build the API image → (only if green) deploy** all four
services via deploy hooks. Nothing ships unless CI passes.

> One-time provisioning (steps 1–4 above) still happens once in the dashboards — that
> creates the services and does the first deploy. After that, every push to `main`
> auto-deploys through the pipeline.

**a) Turn off native auto-deploy** (so the pipeline is the only thing that deploys —
no double builds):
- Render: already handled — `render.yaml` sets `autoDeploy: false` on the API + worker.
- Vercel: each project → **Settings → Git** → disable automatic production deployments.

**b) Create deploy hooks:**
- Render → `usafe-api` → **Settings → Deploy Hook** → copy URL.
- Render → `usafe-worker` → **Settings → Deploy Hook** → copy URL.
- Vercel → `usafe-web` → **Settings → Git → Deploy Hooks** → create one for branch
  `main` → copy URL. Same for `usafe-admin`.

**c) Add them as GitHub repo secrets** (**Settings → Secrets and variables → Actions**):
| Secret | Value |
|---|---|
| `RENDER_DEPLOY_HOOK_API` | Render API deploy-hook URL |
| `RENDER_DEPLOY_HOOK_WORKER` | Render worker deploy-hook URL |
| `VERCEL_DEPLOY_HOOK_WEB` | Vercel storefront deploy-hook URL |
| `VERCEL_DEPLOY_HOOK_ADMIN` | Vercel admin deploy-hook URL |

Done — now `git push` to `main` builds, tests, and deploys everything automatically.
(Pull requests run the build/typecheck gates only, no deploy.)

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
