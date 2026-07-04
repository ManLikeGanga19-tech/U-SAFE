# M-Pesa (Safaricom Daraja) — STK Push

The backend supports three modes via `MPESA_MODE` in `.env`:

| Mode | Use | Network | Callback |
|---|---|---|---|
| `mock` | local dev (default) | none | ARQ worker simulates confirmation after `MPESA_MOCK_DELAY`s; phone ending in `0` = failure |
| `sandbox` | real Daraja sandbox | live | needs a **public HTTPS callback URL** |
| `live` | production | live | production Daraja |

## What Daraja needs (sandbox)
- Consumer Key + Consumer Secret (your Daraja app) → `MPESA_CONSUMER_KEY/SECRET`
- Lipa-na-Mpesa Passkey → `MPESA_PASSKEY` (sandbox passkey pairs with shortcode `174379`)
- Business Shortcode → `MPESA_SHORTCODE=174379` (sandbox default)
- **A public HTTPS callback URL** → `MPESA_CALLBACK_URL` (localhost is NOT reachable by Daraja)

## Testing sandbox locally (ngrok — stable domain, low maintenance)
`localhost` can't receive Daraja callbacks, so expose the API with a tunnel. We use
**ngrok with a reserved domain** so `MPESA_CALLBACK_URL` never changes across restarts.

**One-time setup**
1. Create a free account at https://dashboard.ngrok.com → copy your **authtoken**.
2. Claim your free **static domain** (Dashboard → Domains) e.g. `usafe-dev.ngrok-free.app`.
3. Put both in `.env`:
   ```
   NGROK_AUTHTOKEN=<your token>
   NGROK_DOMAIN=usafe-dev.ngrok-free.app
   MPESA_MODE=sandbox
   MPESA_CALLBACK_URL=https://usafe-dev.ngrok-free.app/api/v1/payments/mpesa/callback
   ```

**Run it**
```bash
# start the tunnel (compose "tunnel" profile) and recreate the API with the new env
docker compose -f infra/docker-compose.dev.yml --env-file .env --profile tunnel up -d ngrok api worker

# inspect requests/callbacks at  http://localhost:4040
```

Because the domain is reserved, the callback URL is stable — you set it once. Stop the
tunnel with `docker compose -f infra/docker-compose.dev.yml --profile tunnel stop ngrok`.

### Test numbers / results
- `254708374149` — Safaricom sandbox test MSISDN → always returns **ResultCode 1037** ("DS timeout, user cannot be reached"), i.e. a *failure* (no real device to enter a PIN). Good for proving the callback round-trip.
- **A real Safaricom number you control** → you get the actual STK prompt; entering your PIN returns **ResultCode 0** → order paid + stock decremented.

When done testing, set `MPESA_MODE=mock` and recreate the API so pending orders don't hang, and stop the tunnel: `docker rm -f usafe-tunnel`.

## Production (Render)
No tunnel needed — the callback is your stable API domain:

```
MPESA_MODE=live            # or sandbox to stage
MPESA_CALLBACK_URL=https://api.u-safe.co.ke/api/v1/payments/mpesa/callback
```

Set the credentials as Render environment secrets (see `infra/render.yaml`, keys marked `sync: false`).
