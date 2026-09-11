# Work Plan — Nilesh

**Role:** Frontend & Notification Engineer — Ops Dashboard, Notification Engine & Metrics
**Project:** LXP Hub (`habibi-hub`)
**Architecture reference:** `LXP_Hub_Technical_Design.html` — §3.1–3.3 (Persona Flows), §4.2 (Confirmation flow), §5.1 (Internal Hub API)

---

## Team structure

| Person | Lane | Owns |
|---|---|---|
| **Chitrank** | Backend Core | Database, state machine, internal REST API, auth |
| **Abhay** | Integrations & Sync | IS-Demos / PopBookings / TrustedHerd clients, poller |
| **Nilesh** | Frontend & Notifications | Ops dashboard, email/notification engine, metrics views |
| **Kaushal** | Project Lead | Architecture sign-off, PR review & merge, roadmap, stakeholder & platform-vendor communication |

> Proposed stack (finalize together at kick-off): **React + Vite + TypeScript** for the dashboard; the notification engine lives in the Node.js backend so it shares the domain-event bus.

---

## Your mission

You build what the team actually sees and what candidates actually receive. The ops team lives inside your dashboard all day — the §3.3 operational loop (create → post → review → book → monitor → close) should take the fewest clicks possible, and no alert should ever get lost in a corner.

---

## Scope of work

### 1. Ops dashboard (§3.3 — the core operational loop)

- **Events**
  - List with filters (status / date / client); detail view with live **staffing %**
  - Create-event form: client, site, date, rate, positions, requirements, dress code, instructions — entered **once**
  - **POST JOB** button → shows per-platform status chips (IS-Demos Posted / PB Posted / TH Failed) with **retry-failed-platform-only** action; never a "re-post everything" button
- **Applicant inbox** (per event, across PB / TH / internal)
  - Cross-platform applicant list with source badges
  - Review → **BOOK** on the chosen candidate → status chip progression: `BookingSent → BookedPendingConfirmation → TalentConfirmed (green)`
  - Declined / no-response states surfaced inline; replacement loop (`ReplacementRequired → back to applicant pool`) one click away
- **Talent DB**
  - Search by location, source, history; profile page with applications, bookings, and full communications log (call/SMS/email)
- **Priority queue** (the alert center)
  - Feed of unresolved notifications: `?status=unresolved`
  - Types: missed check-in, replacement required, reporting required, no-response escalation
  - One-click resolve (`PATCH /notifications/{id}/resolve`); stale alerts escalate visually
- **Day-of monitor**
  - Event-day view of check-in status per position, driven by the poller's `shift.checked_in` / `shift.checkin_missing` events — this is where "call/text the talent" happens fast
- **Metrics views**
  - Staffing / recruiting / operations dashboards over `/hub/v1/metrics/...`

### 2. Notification engine (backend service)

Subscribes to **domain events** from the state machine and the poller — never to platform-specific payloads:

| Domain event | Engine action |
|---|---|
| `candidate.confirmed` | Send confirmation email → record delivery status in `confirmation_emails`; update Google Sheet staffing counts; clear pending-confirmation alert |
| `shift.checkin_missing` | Priority alert to queue + immediate team escalation (call/text task) |
| `shift.cancelled` / `replacement.required` | Alert + reopen position in the applicant inbox |
| `reporting.required` | Alert when report not submitted post-shift |
| booking sent, no response past threshold | **Follow-up Engine**: automatic reminder, then escalate to a team member |

- Email service integration (provider TBD — e.g. Resend/SendGrid/SES) with delivery-status tracking back into the Hub
- **Google Sheets sync** of staffing counts per event (client-visible sheet) — idempotent updates, one sheet row per position
- Every notification creates a `Notification` record with severity, assigned team member, and required action — nothing alert-shaped lives only in email

### 3. Client-facing surface (§3.2)

- Live staffing % view for the client (dashboard section or the shared sheet — start with the sheet, build the view in M4)
- Post-event completion / reporting status

### 4. Candidate-facing bits (§3.1)

- Booking accept/decline and status transparency ride on the PB/TH platforms — the Hub only displays state; the **Payment Agreement** step (when required) hands off to PopBookings. Do not rebuild PB flows in the Hub.

---

## Milestones

| # | When | Deliverable |
|---|---|---|
| M1 | Weeks 1–2 | App scaffold + design system; events list/detail + create form running against Chitrank's OpenAPI mocks |
| M2 | Weeks 3–4 | Applicant inbox with BOOK flow, talent DB, priority queue |
| M3 | Weeks 4–5 | Notification engine live: confirmation emails, Sheets sync, follow-up escalations |
| M4 | Week 5+ | Metrics dashboards + client-facing staffing view |

---

## Interfaces with other lanes

- **Chitrank** publishes the OpenAPI contract — you build against mocks from day one; breaking changes go through a spec PR, never a surprise
- **Abhay's** poller and the state machine emit the domain events you consume — agree on event names + payload schemas in week 1 and version them
- **Kaushal** reviews UX flows against the master workflow and is the escalation point for scope changes

## Out of scope for you

- External API clients and polling (Abhay)
- Schema / state machine internals (Chitrank)

## Definition of done

- Every screen works against the real API contract, not hardcoded fixtures
- Alerts never silently dropped: every domain event either creates a notification or is explicitly ignored with a reason
- Emails verified in spam-safe HTML/text templates; delivery status persisted
- PR reviewed and merged to `main`

---

## Working agreement

- Branches: `feat/ui-<topic>` / `feat/notif-<topic>` / `fix/ui-<topic>`
- Small PRs, screenshots or Loom link attached for UI changes, one approval before merge (lead merges)
- New API need → comment on the OpenAPI spec PR first
- Weekly sync: demo the loop end-to-end, flag friction points
