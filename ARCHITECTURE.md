# U-SAFE KE — System Architecture

> Multi-brand PPE / safety-equipment commerce platform + admin control plane.
> Company: U-SAFE KE, Nairobi, Kenya. Tagline: *"Ensuring you are safe."*
> Status: **Architecture draft — pre-implementation.**

---

## 1. Product scope

Two applications over one backend:

1. **Commercial storefront** — public, SEO-first product catalog with cart, checkout
   (M-Pesa) and a B2B **Request-a-Quote / bulk-order** path. Serves both walk-in
   consumers and industrial B2B buyers (mining, construction, petroleum, medical,
   manufacturing, etc.).
2. **Admin control plane** — staff-only. Regulates every stock item and everything
   shown on the commercial site: products, inventory, categories, brands, orders,
   quotes, customers, and curated homepage/marketing content.

### Domain notes that shape the build
- **B2B-heavy customer base** → quotes, bulk orders, and (future) account/tier pricing
  are first-class, not afterthoughts.
- **Compliance angle** (profile: *"monitoring PPE usage per employee"*,
  *"documented proof of legislative compliance"*) → reporting/analytics is a
  planned surface; the Python backend is chosen partly for this.
- **Brands are a first-class entity** (3M, Vaultex, Portwest, Ansell, JSP, Safety
  Jogger, ACE, Bata, Bulldog, BOVA, Ultimate, Honeywell, Uvex, Timberland, Talan,
  JCB, CAT, Protecta, Safetoe).

---

## 2. Tech stack (decided)

| Layer | Technology | Notes |
|---|---|---|
| Storefront | Next.js 15 (App Router), React 19, TypeScript | SSR/ISR for catalog SEO |
| Admin | Next.js 15 (separate app) | Security-isolated from storefront |
| Styling | Tailwind CSS + custom design tokens | `borderRadius` disabled in theme (hard rule) |
| Backend API | FastAPI (Python 3.12), Uvicorn/Gunicorn | Owns all business logic + DB |
| ORM / migrations | SQLAlchemy 2.0 (async) + Alembic | |
| Schemas / contract | Pydantic v2 → OpenAPI → typed TS client | Frontend type-safety from Python |
| Database | PostgreSQL 16 | |
| Cache / queue | Redis + ARQ | callbacks, email, PDF, reconciliation |
| Payments | M-Pesa Daraja (STK Push) + Request-a-Quote | Card rails deferred |
| Media/object store | **S3-compatible** — Cloudflare R2 now, MinIO on VPS later | one abstraction, swappable endpoint |
| Search | Postgres FTS → Meilisearch (later) | |
| Containerization | Docker (Dockerfile for API) | portability to VPS later |
| CI/CD | GitHub Actions (checks) + platform Git deploys | Render + Vercel auto-deploy on push |
| **Hosting (now)** | **Backend → Render, Frontend → Vercel** | fastest path, managed TLS/DB/Redis |
| **Hosting (later)** | Self-managed VPS (Hetzner/DigitalOcean) + Caddy | migration = config change, not rewrite |
| Email | Deferred (Zoho or transactional TBD) | decide before Phase 2 |

**Why Python backend:** the business is a compliance/usage-reporting product wrapped
in an e-commerce shell. FastAPI + the Python data ecosystem is where reporting, PDF
generation, and future analytics/ML live naturally. Cost: two languages + an API
contract, neutralized by OpenAPI→TS codegen.

---

## 3. System topology

### Now — Render + Vercel (managed PaaS)

```
                          Internet
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                     │
   VERCEL                  VERCEL              CLOUDFLARE R2
   usafeke.com        admin.usafeke.com      (media, S3 API)
   ┌────▼────┐          ┌────▼────┐           ┌────▼────┐
   │ web     │          │ admin   │           │ objects │
   │ (Next)  │          │ (Next)  │           └─────────┘
   └────┬────┘          └────┬────┘
        └─────────┬──────────┘
                  │  HTTPS → api.usafeke.com
        ┌─────────▼───────────────── RENDER ──────────────┐
        │  ┌─────────┐   ┌──────────────┐                 │
        │  │ api      │   │ arq worker    │  (same image)  │
        │  │(FastAPI) │   │ background    │                │
        │  └────┬─────┘   └──────┬───────┘                 │
        │       └────────┬───────┘                         │
        │        ┌───────▼──────┐   ┌──────────────┐       │
        │        │ Render       │   │ Render       │       │
        │        │ PostgreSQL   │   │ Key Value    │       │
        │        │              │   │ (Redis)      │       │
        │        └──────────────┘   └──────────────┘       │
        └──────────────────────────────────────────────────┘
```

- Vercel & platform manage TLS/CDN for the frontends; Render manages TLS for the API.
- Storefront & admin call **only** `api.usafeke.com` (never the DB directly).
- ARQ worker is a second Render service off the **same Docker image**, running jobs off Redis.
- Media on Cloudflare R2 via the S3 API; public bucket for product images, private for quote PDFs.

### Later — VPS (Hetzner/DigitalOcean) migration

Same containers, re-homed behind **Caddy** (auto-TLS) on one host: `web`, `admin`,
`api` + `arq worker`, `postgres`, `redis`, and `minio` replacing R2 (identical S3 API).
Because every dependency is reached by env-var endpoint, the migration is a compose
file + DNS change — **no application code changes.**

---

## 4. Repository layout (monorepo)

```
usafe/
├── apps/
│   ├── web/                 # Next.js storefront
│   └── admin/               # Next.js admin
├── services/
│   └── api/                 # FastAPI backend
│       ├── app/
│       │   ├── core/        # config, security, db session
│       │   ├── models/      # SQLAlchemy models
│       │   ├── schemas/     # Pydantic
│       │   ├── api/         # routers (v1)
│       │   ├── services/    # domain logic (orders, inventory, mpesa, quotes)
│       │   ├── workers/     # ARQ tasks
│       │   └── main.py
│       ├── alembic/
│       └── pyproject.toml
├── packages/
│   ├── ui/                  # shared React design system (no-radius)
│   ├── api-client/          # generated TS client from OpenAPI
│   └── config/             # shared tailwind tokens, tsconfig, eslint
├── infra/
│   ├── docker-compose.dev.yml     # local dev: api, worker, postgres, redis, minio
│   ├── docker-compose.vps.yml     # future self-hosted prod (+ Caddy)
│   ├── Caddyfile                  # used only on the VPS
│   └── render.yaml                # Render blueprint (api + worker + db + redis)
└── .github/workflows/
```

Frontend tooling: **pnpm + Turborepo**. Python: **uv** or Poetry, isolated in `services/api`.

---

## 5. Core data model (first pass)

Entities (relational, PostgreSQL):

- **User** — role: `customer | staff | admin | super_admin`. Separate customer vs staff realms.
- **Company / Account** *(B2B)* — organization a customer belongs to; future tier pricing.
- **Brand** — name, slug, logo, description.
- **Category** — self-referential tree (the 12 PPE categories from the profile).
- **Product** — name, slug, description, brand_id, category_id, spec sheet, EN/ISO
  standards, images[], status (`draft | published | archived`), featured flag.
- **ProductVariant** — SKU, size/color/attributes, price (KES), barcode.
- **InventoryItem** — variant_id, quantity_on_hand, reorder_level, warehouse/location.
- **StockMovement** — audit log: variant_id, delta, reason (`sale | restock | adjustment | return`), actor, timestamp. *(source of truth for stock)*
- **Cart / CartItem** — session or user-bound.
- **Order / OrderItem** — status (`pending | paid | processing | fulfilled | cancelled | refunded`), totals, address, payment refs.
- **Payment** — provider (`mpesa`), status, Daraja `CheckoutRequestID`, callback payload, reconciliation state.
- **Quote / QuoteItem** *(B2B)* — request → admin pricing → PDF → accepted/expired.
- **ContentBlock** — homepage banners, featured collections, promo strips (the CMS-lite
  that controls "what's shown on the commercial site").
- **AuditLog** — who changed what in admin.

Stock is **event-sourced via `StockMovement`**; `quantity_on_hand` is a materialized
convenience column reconciled from movements. This gives a defensible audit trail
(important for a compliance-oriented company).

---

## 6. Backend (FastAPI) module breakdown

- `core/` — settings (pydantic-settings, per-env), DB async session, security (argon2
  hashing, JWT access+refresh, OAuth2 password flow), dependencies (current_user, RBAC).
- `catalog/` — products, variants, categories, brands, search.
- `inventory/` — stock movements, reconciliation, low-stock alerts.
- `cart/` — server-authoritative cart (Redis-backed, mergeable on login).
- `orders/` — order lifecycle state machine.
- `payments/mpesa/` — Daraja STK Push initiate + callback handler + reconciliation job.
- `quotes/` — request intake, admin pricing, PDF generation (WeasyPrint), lifecycle.
- `content/` — CMS blocks for storefront curation.
- `admin/` — staff-only endpoints, guarded by RBAC.
- `workers/` — ARQ: mpesa reconciliation, transactional email, PDF render, low-stock alerts.

All write paths emit `AuditLog` + (where relevant) `StockMovement`.

---

## 7. Payments & B2B flows

### M-Pesa STK Push (Daraja)
1. Customer checks out → `POST /payments/mpesa/stk` → backend calls Daraja, gets
   `CheckoutRequestID`, creates `Payment(pending)` + `Order(pending)`.
2. Customer approves on phone.
3. Daraja hits `POST /payments/mpesa/callback` → verify → mark `Payment(success)` →
   `Order(paid)` → decrement stock via `StockMovement(sale)`.
4. ARQ reconciliation job re-queries Daraja for any callback we missed (idempotent).

### Request-a-Quote (B2B)
1. Buyer builds a cart / list → submits quote request (no payment).
2. Admin reviews, sets bulk pricing, generates a **PDF quote** (branded).
3. Quote emailed; buyer accepts → converts to an order (paid offline / invoiced, or
   M-Pesa on smaller totals).

---

## 8. Design system — "industrial safety-signage" (no generic AI UI)

**Hard rules**
- **Zero border-radius anywhere.** Enforced in `tailwind.config` (`borderRadius: { none: '0px', DEFAULT: '0px' }`) so it can't creep in.
- Reject default SaaS gradients/soft-shadow card look.

**Language**
- Strong modular grid, hard 90° corners, generous negative space.
- Heavy condensed display type for headings; clean grotesque for body.
- Hi-vis accents used like actual safety signage (sparingly, with intent).
- Optional hazard-stripe motif and EN/ISO-catalog framing as brand texture.

**Brand tokens** (from logo + profile, to be finalized against exact hex sampling)

| Token | Approx | Role |
|---|---|---|
| `brand.blue` | `#0B3F9E` | primary, nav, headings |
| `brand.green` | `#4CE617` | primary CTA / safety accent (the logo "U") |
| `brand.black` | `#0B0B0B` | structure, text, logo shield |
| `brand.cyan` | `#3FA9F5` | secondary |
| `accent.orange` | `#F57C00` | alerts, sale, hi-vis |
| neutrals | grey scale | canvas, borders, surfaces |

Shared components live in `packages/ui`, consumed by both apps.

---

## 9. Auth & security

- Customer and staff are separate login realms; admin app is a distinct origin.
- JWT access (short) + refresh (rotating, httpOnly cookie). Argon2id hashing.
- RBAC: `customer | staff | admin | super_admin`, enforced by FastAPI dependencies.
- Rate limiting (Redis) on auth + payment endpoints.
- Daraja callback: IP allow-list + signature/payload validation + idempotency keys.
- Secrets via env / Docker secrets, never in repo. Separate secrets per environment.
- CORS locked to known origins per environment.

---

## 10. Environments & delivery

| Env | Purpose | Backend | Frontend | Data |
|---|---|---|---|---|
| **dev** | local | Docker Compose, seeded | `pnpm dev` | local Postgres + MinIO |
| **staging** | QA, Daraja sandbox | Render (staging service) | Vercel preview/staging | Render Postgres (staging) |
| **production** | live, Daraja live creds | Render (prod service) | Vercel production | Render Postgres (prod), backed up |

- **CI (GitHub Actions):** lint + typecheck (TS + mypy) → tests (pytest, vitest) →
  build the API Docker image (proves it builds; also the VPS artifact later).
- **CD:** Render auto-deploys the API/worker on push (runs Alembic migrate on release);
  Vercel auto-deploys web/admin. Branch → env mapping: `develop` → staging, `main` → prod.
- **Migrations:** Alembic runs as a Render pre-deploy/release step so schema is applied
  before new code serves traffic.
- **Backups:** Render managed Postgres backups; R2 versioning on media.
- **Observability:** structured JSON logs, Sentry (errors), uptime check on `/health`.

---

## 11. Delivery roadmap (phased)

1. **Phase 0 — Foundations:** monorepo, Docker dev stack, CI, design system skeleton,
   auth, base schema + migrations.
2. **Phase 1 — Catalog:** brands/categories/products/variants, admin CRUD, storefront
   catalog + PDP, search, media pipeline (S3 API → R2).
3. **Phase 2 — Commerce:** cart, checkout, M-Pesa STK + callbacks, orders, inventory
   decrement + stock movements.
4. **Phase 3 — B2B + CMS:** Request-a-Quote, PDF quotes, homepage content blocks,
   featured curation.
5. **Phase 4 — Ops & polish:** reporting/compliance dashboards, low-stock alerts,
   staging→prod hardening, backups, monitoring.

---

## 12. Open items to confirm before Phase 0

- Exact brand hex values (sample from logo/flyer PNGs).
- Domain/subdomain plan (`usafeke.com`, `admin.usafeke.com`, `api.usafeke.com`) —
  Vercel for the two web apps, Render custom domain for the API.
- ~~VPS~~ → **Render (backend) + Vercel (frontend) for now**; VPS migration deferred.
- Cloudflare R2 account for media (S3 API).
- Email provider — **deferred** (Zoho for `@usafeke.com`, or transactional like Resend);
  decide before Phase 2 (order confirmations / quote emails need it).
- Whether card payments (Pesapal/Flutterwave) join in Phase 2 or stay deferred.
- B2B tier pricing: v1 or later.
```
