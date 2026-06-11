# Mana Web — onboarding + core money app

Vite + React + TypeScript SPA for the Mana onboarding + core-money funnel
(login → KYC → balance → add-money → card). Runs against the **shared EC2
backend** — the same `/v1/*` API the mobile app uses.

> This is **not** the marketing site. The marketing/landing page is a separate
> project at `../WEB-APP/` (`mana-landing`). This app is the authenticated funnel.

## Stack & decisions

- **Vite SPA + `@privy-io/react-auth`** (not Next.js — SSR buys nothing behind
  login; marketing/SEO is the separate landing site's job).
- **Auth/session:** in-memory Privy bearer JWT, sent as `Authorization: Bearer`
  on each request — identical to the mobile app + BE auth middleware. No cookies,
  no CSRF layer.
- **Hosting (target):** AWS-native (CloudFront + S3 / Amplify).
- Same Privy app as mobile → **same user DID**. Web login is **email OTP only**
  (Privy SMS is US/CA-only).

See `../../claude/projects/kinnectfi/web-app-scope.md` for the full funnel +
phase plan, and `web-build-state.md` for the session journal.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build → dist/
npm run typecheck  # tsc -b --noEmit
```

## Env (`.env`, all `VITE_*` are public/bundled)

| Var | Meaning |
|---|---|
| `VITE_API_URL` | Backend base URL (EC2 ngrok tunnel, or `http://localhost:3000` for a local BE) |
| `VITE_PRIVY_APP_ID` | Privy DEV app id (same app as mobile) |
| `VITE_PRIVY_CLIENT_ID` | Privy app client id |

### CORS / dev gotchas

- A browser call to the API only works if the BE has **`@fastify/cors`** with
  `WEB_ORIGINS` including this app's origin (`http://localhost:5173`). The local
  BE `.env` already sets this; the **EC2 BE must be redeployed** with the CORS
  change + `WEB_ORIGINS` before the ngrok→EC2 lane will accept browser calls.
- The web origin must also be added to **Privy dashboard → allowed origins**.
- Port 5173 may be taken by another project's dev server — free it (or change the
  port and update `WEB_ORIGINS` + Privy origins to match).
```
