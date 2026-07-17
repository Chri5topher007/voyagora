# Voyagora — Engineering Audit & Deployment Guide

This document covers two passes: the first made the app deployable at all;
the second (this one) hardened it to "rock-solid, secure, ready for real
users." Both are recorded here so nothing gets lost.

## Round 2 — security & reliability hardening

### Real bugs found and fixed
1. **`paymentChoice` was silently dropped in the booking checkout
   controller.** Anyone who selected "pay advance" in the UI was charged
   the full amount anyway — the field never reached the service. Fixed.
2. **Two route-ordering bugs made endpoints unreachable.** `/tours/stats`
   and `/community/pending` were declared *after* their `:id` sibling
   routes, so Express matched `:id` first and treated "stats"/"pending" as
   an ID — the organizer analytics page and the admin pending-approvals
   page were both silently broken. Fixed by reordering.
3. **`itemType` was an unvalidated free-text field** used to dynamically
   pick a Prisma model (`prisma[itemType].findUnique(...)`) in booking,
   review, and wishlist endpoints. A client could send `itemType: "user"`
   and get undefined behavior instead of a clean rejection. Now restricted
   to a whitelist (`tour`/`event`) via DTO validation.
4. **The image upload endpoint had no authentication at all.** Anyone on
   the internet could upload files to your Cloudinary account and run up
   storage/bandwidth costs. Now requires a logged-in user, plus a 5MB
   per-file limit.
5. **Any logged-in user (not just the organizer) could check in any
   ticket** via the QR scanner endpoint. Now restricted to the organizer
   who owns that tour/event, or an admin.
6. **Anyone could register as `role: "ADMIN"`** by calling the API
   directly (found in round 1, still worth restating): registration is
   now restricted to `TRAVELER`/`ORGANIZER`.
7. **Zero request validation existed anywhere.** Every controller accepted
   loosely-typed `any` bodies. Added `class-validator` DTOs across every
   endpoint (tours, events, bookings, reviews, wishlist, community, AI
   planner, profile, auth) with a global `ValidationPipe` that rejects
   unknown fields and enforces types/ranges/formats.
8. **A hardcoded `localhost:8080` link was baked into every notification
   email**, regardless of the real deployed domain. Now uses `FRONTEND_URL`.
9. **The API always listened on a hardcoded port 3000**, which doesn't work
   on Render (which assigns its own `PORT`). Now reads `process.env.PORT`.

### Reliability: payments now confirm even if the browser doesn't cooperate
Previously, a booking or subscription was only ever recorded when the
customer's browser successfully redirected back to `/checkout/success` and
called the API. If they closed the tab right after paying, Stripe had the
money and Voyagora had no record of it.

Added a **Stripe webhook** (`POST /webhooks/stripe`) that Stripe calls
directly, server-to-server, the moment a payment completes — independent of
the browser. It's signature-verified and idempotent (a `ProcessedStripeEvent`
table prevents double-processing if Stripe redelivers an event).

**You need to set this up in the Stripe dashboard** (one-time, ~2 minutes):
1. Dashboard → Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://<your-api-domain>/webhooks/stripe`
3. Select event: `checkout.session.completed`
4. Copy the "Signing secret" (starts with `whsec_`) into `STRIPE_WEBHOOK_SECRET`

Without this, the app still works exactly as before (browser-redirect
confirmation) — the webhook is an added safety net, not a replacement.

### Auth: short-lived tokens, real password reset, revocable sessions
- Access tokens now expire in **1 hour** instead of 7 days, paired with a
  revocable, rotating **refresh token** (30 days) stored as a hash in the
  database. The frontend (`src/lib/api.ts`) automatically refreshes access
  tokens in the background — users won't notice, but a stolen access token
  is now only useful for an hour instead of a week.
- Added a real **forgot password / reset password** flow: `/auth/forgot-password`
  and `/auth/reset-password` on the backend, matching `/forgot-password` and
  `/reset-password` pages on the frontend. Reset links expire in 30 minutes
  and are single-use. Resetting a password revokes all existing sessions.
- Added `/auth/logout` which revokes the refresh token server-side (not just
  clearing it client-side).
- Login/register/forgot-password/reset-password are now rate-limited
  per-IP specifically (on top of the global rate limit) to slow down
  brute-force attempts.

### Authorization: role-based guards instead of scattered manual checks
Replaced ad-hoc `if (req.user.role !== 'X') throw ForbiddenException(...)`
checks scattered through controllers with a single declarative
`@Roles('ORGANIZER')` decorator + `RolesGuard`, applied consistently across
tours, events, admin, and community-moderation endpoints.

### Everything else
- Global exception filter: every error response now has the same shape and
  unexpected crashes are logged server-side without leaking internals
  (stack traces, DB errors) to the client.
- Added database indexes on every foreign key and frequently-filtered
  column (bookings by user/tour/event, tours/events by organizer, etc.) —
  matters once you have more than a handful of rows.
- Added a `/health` endpoint (checks DB connectivity) for Render's health
  checks and uptime monitoring.
- AI itinerary endpoint now has its own tighter rate limit, since each call
  costs real OpenAI API spend.

### What's still a reasonable next step (explicitly out of scope for this pass)
You asked for "rock-solid and secure," not "maximum enterprise depth," so
these were intentionally left for later:
- Automated test suite (Jest is already installed as a dev dependency,
  ready whenever you want to start adding tests)
- CI/CD pipeline (GitHub Actions running build/lint on every push)
- Structured logging / error tracking service (e.g. Sentry)
- Email verification on signup (currently accounts are usable immediately
  after registration)

---

## Round 1 recap (previous pass — still true)
- Fixed 22 frontend files hardcoded to `http://localhost:3000`
- Fixed 8 of 12 controllers whose JWT guard never read `JWT_SECRET` from
  the environment (would have locked out every logged-in feature the
  moment a real secret was set)
- Removed hardcoded secrets from `docker-compose.yml`
- Added SPA routing fallback (`nginx.conf`) so client-side routes don't
  404 on refresh
- Split the frontend bundle (was 1.25MB, now ~120KB initial load)

---

## Local development
```bash
cp .env.example .env            # fill in real values
docker compose up --build       # postgres + api (port 3000) + web (port 8080)
```
Optional demo data (staging only, never on real production data — these
accounts all share one password):
```bash
docker compose exec api npm run seed
```

## Going live
I don't have access to your hosting accounts, domain registrar, or live API
keys, so I can't flip this to a public URL myself — but here's exactly what
to do.

### Environment variables the API needs in production
| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → Connection string (direct, port 5432) |
| `JWT_SECRET` | Generate: `openssl rand -base64 48` |
| `FRONTEND_URL` | Your deployed frontend URL (e.g. Vercel URL) |
| `STRIPE_SECRET_KEY` | Stripe dashboard → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard → Webhooks (see setup steps above) |
| `OPENAI_API_KEY` | platform.openai.com/api-keys |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | cloudinary.com/console |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Your SMTP provider |
| `NODE_ENV` | `production` |

### Frontend (Vercel) build env
| Variable | Value |
|---|---|
| `VITE_API_URL` | Your deployed API URL (e.g. Render URL) |

### Smoke test checklist before calling it launched
1. Register a traveler account and an organizer account
2. As organizer: create a tour, check `/tours/stats` loads (this was the
   broken-route bug — confirm it's fixed)
3. As traveler: book it choosing "pay advance" specifically, run a real
   Stripe test-mode payment, confirm the **partial** amount was charged
4. Confirm the booking shows up in "My Bookings" with a QR code
5. As organizer, scan/check in the ticket; confirm a second scan is rejected
6. Try "forgot password" end to end, including the emailed link
7. Confirm a booking confirmation email arrives and its link points to your
   real domain, not localhost
8. In Stripe dashboard → Webhooks, confirm the webhook shows successful
   deliveries after a test payment
