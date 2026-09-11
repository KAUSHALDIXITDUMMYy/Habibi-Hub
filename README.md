# Habibi Hub (LXP Hub)

A staffing operations hub that unifies event staffing across **PopBookings**, **TrustedHerd**, and the **IS-Demos External API** under one internal data model.

One internal `Event` record is the anchor — positions, applications, bookings, talent, communications, and notifications all hang off it or off the shared `Talent` record, so no candidate or event is ever duplicated per platform. External identifiers live in a separate mapping table, sync is watermark-based polling (no webhooks exist on any platform), and a single universal candidate pipeline drives all automation — emails, alerts, and metrics react to state changes, not to platform-specific events.

## Team & work division

| Person | Lane | Work plan |
|---|---|---|
| Chitrank | Backend Core — data model, pipeline state machine, internal Hub API, auth | [docs/work-for-chitrank.md](docs/work-for-chitrank.md) |
| Abhay | Integrations & Sync — IS-Demos / PopBookings / TrustedHerd clients, poller | [docs/work-for-abhay.md](docs/work-for-abhay.md) |
| Nilesh | Frontend & Notifications — ops dashboard, notification engine, metrics | [docs/work-for-nilesh.md](docs/work-for-nilesh.md) |
| Kaushal | Project Lead — architecture sign-off, PR review & merge, roadmap, stakeholder communication | — |

## Run the MVP

```bash
npm install
npm start          # → http://localhost:3000
```

Requires Node 18+. First boot seeds `data/db.json` with a mid-operation demo snapshot (today's event at 67% staffing, a failed TrustedHerd posting, an unresolved check-in alert). Reset anytime with `npm run reseed`.

### What the MVP proves (the §3.3 operational loop, end to end)

1. **Create event** → entered once, slots generated
2. **POST JOB** → posts to all three platforms (stub); when one fails, only that platform is retried — never a re-post of the rest (§5.3)
3. **Applicant inbox** → cross-platform applicants with source badges; Review → Select → **BOOK**
4. **Booking** → wraps the IS-Demos call; talent response cascades through the payment-agreement branch (§3.1)
5. **Confirmation** → engine sends the confirmation email (stub), auto-advances the pipeline, logs comms
6. **Event day** → check-in / no-show via the poller stand-in; no-shows cascade to `ReplacementRequired` and reopen the slot; a replacement can be re-selected and booked from the same inbox
7. **Alerts** → priority queue with severities, one-click resolve; staffing % and talent counters stay current throughout

Dashed amber buttons in the UI are **dev/poller simulator** actions (`/hub/v1/dev/*`) — they stand in for the real IS-Demos watermark poller (§4.3) until the Integration lane lands.

### MVP scope & seams (what each lane replaces)

| Piece | MVP implementation | Replaced by (lane / milestone) |
|---|---|---|
| Data model & store | JSON file store behind a repository boundary (`server/db.js`) | PostgreSQL + migrations (Chitrank, M1) |
| State machine | `server/stateMachine.js` — full §2 transition table, illegal moves rejected, history logged | Hardens into a service package + tests (Chitrank, M2) |
| Internal API | Full §5.1 surface under `/hub/v1` (`server/routes.js`) | Contract-first OpenAPI + auth/roles (Chitrank, M3–M4) |
| Integrations | Stub adapters with the real contracts' shapes (`server/integrations.js`) | Real IS-Demos client + watermark poller, PB/TH adapters (Abhay, M1–M4) |
| Notification engine | Transition-driven alerts + confirmation-email stub (`server/notifications.js`) | Real email provider, Sheets sync, follow-up engine (Nilesh, M3) |
| Dashboard | Vanilla JS single page (`public/`) | React + Vite scaffold (Nilesh, M1) |

```
server/   API, state machine, notification engine, stub integrations, seed
public/   ops dashboard (no build step)
docs/     individual work plans
```

> The walking skeleton is intentionally dependency-light (Express only) and in plain
> JavaScript — the TypeScript/Postgres/React stack from the work plans is finalized at
> kick-off, and each seam above says exactly where it lands.

## Documentation

- **Architecture / technical design** — `LXP_Hub_Technical_Design.html` (data model, pipeline state machine, persona flows, integration sequences, API structure, gaps vs. ambition). Open in a browser; diagrams render via Mermaid.
- Individual work plans live in [`docs/`](docs/) — each includes scope, milestones, cross-lane interfaces, and a definition of done.

## Status

MVP walking skeleton shipped — the full operational loop (create → post → review → book → confirm → check in → complete, plus no-show replacement and cancellation cascades) runs end to end against stub integrations. Next: each lane builds on its seam per the work plans.

## Working agreement

- Feature branches: `feat/<lane>-<topic>`, fixes: `fix/<lane>-<topic>`
- Small PRs to `main`, one approval required before merge (lead merges)
- Schema/API contract changes that touch another lane go through a spec PR first
- Weekly sync: demo progress, flag blockers early
