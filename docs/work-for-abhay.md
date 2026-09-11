# Work Plan — Abhay

**Role:** Integration Engineer — IS-Demos / PopBookings / TrustedHerd Clients & Sync Poller
**Project:** LXP Hub (`habibi-hub`)
**Architecture reference:** `LXP_Hub_Technical_Design.html` — §3.4 (Poller flow), §4 (Integration Sequences), §5.2 (IS-Demos API), §6 (Gaps)

---

## Team structure

| Person | Lane | Owns |
|---|---|---|
| **Chitrank** | Backend Core | Database, state machine, internal REST API, auth |
| **Abhay** | Integrations & Sync | IS-Demos / PopBookings / TrustedHerd clients, poller |
| **Nilesh** | Frontend & Notifications | Ops dashboard, email/notification engine, metrics views |
| **Kaushal** | Project Lead | Architecture sign-off, PR review & merge, roadmap, stakeholder & platform-vendor communication |

> Proposed stack (finalize together at kick-off): **TypeScript** end-to-end, **PostgreSQL**, **Node.js** (NestJS or Express) for the Hub API. The integration lane is a library/service inside the Hub backend.

---

## Your mission

You are the Hub's connection to the outside world. Ops clicks **POST JOB** once and it lands on three platforms; the Hub learns about check-ins, confirmations, and cancellations through your poller — because **none of these platforms offer webhooks**. Everything in §6 of the design doc (the gaps table) is your reality check.

---

## Scope of work

### 1. IS-Demos API client (§5.2 — the documented contract)

- Base URLs: `https://apitest.isdemos.com` (sandbox) / `https://api.isdemos.com` (prod), all under `/api/v1`
- Auth: `X-Api-Key` + `X-Api-Secret` headers, scoped per client — credentials come from `platform_configs` (never hardcode)
- Wrap every endpoint the Hub uses:
  - `/status` — health check before each poll cycle
  - `/clients`, `/sites`, `/reference` — client resolution, site picker w/ geo data, lookup tables (shift statuses, job types, chains, states, cancel reasons)
  - `GET /jobs?modified_since=` — the change feed
  - `GET /jobs/{jobId}` — shift detail: `statusId`, `employeeId`, `demonstratorAccepted`, `workCompleted`
  - `POST /jobs` — job + states + chains + shifts in one call
  - `PUT /jobs/{jobId}`, `POST /jobs/{jobId}/cancel`
  - `GET /jobs/{jobId}/applications` — applicant inbox (Applied / Booked / NotSelected)
  - `/staff/{id}`, `/staff/by-email` — resolve a talent's IS-Demos staff ID before booking
  - `GET /bookings?job_id=`, `POST /bookings`, `PATCH /bookings/{shiftId}`, `DELETE /bookings/{shiftId}`
- Sandbox-first: everything proven on `apitest` before touching prod credentials

### 2. POST JOB orchestration (§4.1)

- Ops clicks POST JOB once → you create the IS-Demos job, capture `jobId` + `shiftIds`, store them in `platform_mappings`
- **Partial failure rule:** if PB or TH fails, flag only that platform's row — retry that one row, never re-post the rest. IS-Demos must not get a duplicate job because TH timed out.

### 3. Booking integration (§4.2)

- `POST /bookings {shiftId, staffId}` is the BOOK action
- On success IS-Demos flips the shift to "Demonstrator Accepted" → your code maps that to the domain event `candidate.confirmed`
- `PATCH` / `DELETE` bookings for reassignment and cancellation (position returns to Open)

### 4. Sync poller (§3.4 + §4.3) — the backbone

- Scheduler fires on an interval (**3–5 minutes** — no formal rate limit exists, but list endpoints are unpaged and get slower as volume grows; keep it sensible)
- Loop:
  1. `GET /api/v1/jobs?modified_since=<watermark>`
  2. For each changed job → `GET /api/v1/jobs/{jobId}`
  3. Diff shift fields vs the Hub DB: `statusId`, `employeeId`, `demonstratorAccepted`, `workCompleted`
  4. Emit domain events on material change:
     - `demonstratorAccepted → true` ⇒ `candidate.confirmed`
     - `workCompleted → true` ⇒ `shift.checked_in`
     - shift start time passed, `workCompleted` still false ⇒ `shift.checkin_missing`
     - `statusId = cancelled` ⇒ `shift.cancelled`
  5. Persist the new watermark (`fetchedUtc`) — only after a successful cycle
- **Applicant inbox caveat (§6):** `/applications` has no `modified_since` — each cycle must re-fetch the full applicant list per job and diff against the Hub's stored copy. Budget for that cost and keep per-job diffing incremental.

### 5. PopBookings & TrustedHerd adapter layer

- PB/TH are **session/scraping** based today (spec pending) — treat them as a separate, less reliable integration surface:
  - Hide both behind the **same adapter interface** as IS-Demos so the Hub core never knows the difference
  - Isolate session management, retries, and "did the scrape actually work?" verification
  - Log reliability metrics per platform (post success rate, sync freshness)
- **Payment Agreement** flow is a PopBookings-only concept — it stays entirely inside the PB adapter, never modeled against IS-Demos data

### 6. One-off historical backfill

- Ingest the one-off IS-Demos historical export to seed the internal talent DB (Phase 1). Coordinate with Chitrank's dedup-by-email/phone logic — `modified_since` only tracks API changes going forward, so this export is the only source of history.

---

## Milestones

| # | When | Deliverable |
|---|---|---|
| M1 | Weeks 1–2 | IS-Demos client complete + sandbox smoke tests against `apitest` |
| M2 | Weeks 2–3 | POST JOB + booking + cancel flows end-to-end on sandbox, `platform_mappings` populated |
| M3 | Weeks 3–5 | Poller with watermark persistence, diff engine, all domain events firing |
| M4 | Week 5+ | PB/TH spike → adapter stubs behind the shared interface; historical backfill script run |

---

## Interfaces with other lanes

- **Chitrank** provides the repository/service layer and `platform_mappings` — you write sync results through it, never raw SQL
- **Nilesh** consumes the domain events you and the state machine emit — event names and payloads are a contract; change them via a PR, not a surprise
- **Kaushal** is the contact for IS-Demos/PB/TH vendor questions and credential hand-off

## Out of scope for you

- Schema design, internal Hub API, state machine internals (Chitrank)
- Emails, Sheets sync, dashboard (Nilesh)

## Known traps (from §6 — read this twice)

1. **No webhooks.** Anyone assuming "IS-Demos will push an event" is wrong — everything is your poll.
2. Unpaged list endpoints — poll interval discipline matters.
3. No staff profile depth (skills, ratings, history) — Phase 6 intelligence features are blocked until IS-Demos exposes this or the Hub derives it from its own history.
4. Hub owns the confirmation email — do not wait for a platform to send one.

## Definition of done

- All IS-Demos calls proven against the sandbox; secrets read from `platform_configs`/env only
- Poller idempotent — a crashed cycle must not double-emit events or lose the watermark
- Adapter interface reviewed and merged; PB/TH stubs clearly marked unstable
- PR reviewed and merged to `main`

---

## Working agreement

- Branches: `feat/integrations-<topic>` / `fix/integrations-<topic>`
- Small PRs, one approval required before merge (lead merges)
- Any vendor/API behavior that contradicts the design doc → post it in the team channel same day; §6 gets updated, not ignored
- Weekly sync: sync freshness numbers + platform failure rates on one slide
