# Work Plan — Chitrank

**Role:** Backend Core Engineer — Data Model, Pipeline State Machine & Internal Hub API
**Project:** LXP Hub (`habibi-hub`)
**Architecture reference:** `LXP_Hub_Technical_Design.html` — §1 (Data Model), §2 (Candidate Pipeline), §5.1 (Internal Hub API)

---

## Team structure

| Person | Lane | Owns |
|---|---|---|
| **Chitrank** | Backend Core | Database, state machine, internal REST API, auth |
| **Abhay** | Integrations & Sync | IS-Demos / PopBookings / TrustedHerd clients, poller |
| **Nilesh** | Frontend & Notifications | Ops dashboard, email/notification engine, metrics views |
| **Kaushal** | Project Lead | Architecture sign-off, PR review & merge, roadmap, stakeholder & platform-vendor communication |

> Proposed stack (finalize together at kick-off): **TypeScript** end-to-end, **PostgreSQL**, **Node.js** (NestJS or Express) for the Hub API, **React + Vite** for the dashboard. Raise objections in kick-off week, not after.

---

## Your mission

Own the heart of the Hub. Every other lane builds on top of what you deliver: Abhay writes platform sync data through your repositories, and Nilesh's dashboard consumes your API. One internal `Event` record is the anchor — no candidate or event is ever duplicated per platform.

---

## Scope of work

### 1. Database schema & migrations (§1 of the design doc)

Implement the full class diagram as migrations:

- `clients`, `events`, `positions`, `talent`, `applications`, `bookings`, `platform_mappings`, `confirmation_emails`, `communication_logs`, `notifications`, `team_members`, `platform_configs`
- **Hard rules from the architecture:**
  - External identifiers (PopBookings, TrustedHerd, IS-Demos) live **only** in `platform_mappings` — never inline on core objects.
  - A `Booking` is a thin join: `isDemosShiftId` and `externalBookingId` are the same number in IS-Demos — a booking is a shift with a `staffId` attached. Don't invent a richer booking concept.
  - `Position (0..1) → (0..1) Booking` — one booking per slot at most.
- Seed data + a `docker-compose.yml` for a local Postgres so the whole team runs the same DB.
- One-off **historical import script** for the initial talent-DB backfill (coordinates with Abhay — the IS-Demos export arrives as a one-off dump, not via the API).

### 2. Candidate pipeline state machine (§2)

Implement as an **explicit transition engine**, not scattered status updates:

- Main path: `Applied → Reviewed → Selected → BookingSent → BookedPendingConfirmation → TalentConfirmed → ConfirmationEmailSent → FinalCheckinPending → CheckedIn → ReportingPending → Completed`
- Side branches: `Declined`, `Cancelled → ReplacementRequired → Selected`, `NoShow → ReplacementRequired`
- Requirements:
  - One universal `Application.status` shared across all sources (PB / TH / internal).
  - Every transition is validated (illegal transitions rejected), timestamped (`statusChangedAt`), and written to a transition log.
  - Emit an **internal domain event** on every transition (e.g. `application.talent_confirmed`) — Nilesh's notification engine and Abhay's poller both react to these, never to platform-specific events.

### 3. Internal Hub API (§5.1)

Build the full proposed surface (`/hub/v1/...`):

- Events: list/filter, create (event + positions), detail with staffing %, update, **post** (returns per-platform status), **cancel** (cascades)
- Positions: list per event, PATCH single position status
- Talent: search (location, source, history), profile with applications/bookings/comms log, create with **dedup by email/phone**
- Applications: applicant inbox per event, PATCH to move through the pipeline
- Bookings: create (wraps Abhay's integration layer), PATCH, DELETE (position returns to Open)
- Notifications: `?status=unresolved` queue feed + resolve
- Dashboard summary (today's staffing %, open alert counts) + metrics endpoints (`staffing | recruiting | operations`)
- Platform config: store credentials/base URLs per platform (secrets via env/secret manager — never plaintext columns)

Deliver as **contract-first OpenAPI** so Nilesh can build against mocks from week one.

### 4. Auth & team roles

- `team_members` with roles (Ops, Admin) and permission checks on sensitive endpoints
- Session or token auth for the dashboard; audit trail on who moved an application / resolved a notification

---

## Milestones

| # | When | Deliverable |
|---|---|---|
| M1 | Week 1 | Migrations for all tables + seed + docker-compose; ERD reviewed against §1 |
| M2 | Week 2 | State machine package with full transition table + unit tests for every legal/illegal transition |
| M3 | Weeks 3–4 | REST endpoints for events / positions / applications / bookings / talent + published OpenAPI spec |
| M4 | Week 5 | Auth & roles, notifications + dashboard-summary + metrics endpoints backed by real queries |

---

## Interfaces with other lanes

- **Abhay** writes platform sync results through your repositories and the `platform_mappings` table — expose a clean internal service layer for him; no raw SQL from the integration lane.
- **Nilesh** consumes only your API. Contract changes go through a PR on the OpenAPI spec first; never break his build silently.
- **Domain events are the contract** for the notification engine — publish, don't call.

## Out of scope for you

- External API clients, the poller, PB/TH scraping (Abhay)
- UI, emails, Google Sheets sync (Nilesh)

## Definition of done

- Migrations run clean on a fresh database; seed works
- Unit tests green, illegal state transitions covered
- OpenAPI spec updated in the same PR as any endpoint change
- PR reviewed and merged to `main`

---

## Working agreement

- Branches: `feat/core-<topic>` / `fix/core-<topic>`
- Small PRs, descriptive titles, one approval required before merge (lead merges)
- Any schema or contract change that touches another lane → ping that lane in the PR
- Weekly sync: demo what moved, flag blockers early
