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

## Documentation

- **Architecture / technical design** — `LXP_Hub_Technical_Design.html` (data model, pipeline state machine, persona flows, integration sequences, API structure, gaps vs. ambition). Open in a browser; diagrams render via Mermaid.
- Individual work plans live in [`docs/`](docs/) — each includes scope, milestones, cross-lane interfaces, and a definition of done.

## Status

Kick-off phase. No application code yet — milestones in the work plans are relative weeks from kick-off.

## Working agreement

- Feature branches: `feat/<lane>-<topic>`, fixes: `fix/<lane>-<topic>`
- Small PRs to `main`, one approval required before merge (lead merges)
- Schema/API contract changes that touch another lane go through a spec PR first
- Weekly sync: demo progress, flag blockers early
