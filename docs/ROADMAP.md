# Roadmap

Status: living document, reconstructed from git history and current gaps on
2026-08-31. This is a working roadmap, not a committed release schedule.
Revise it as priorities change.

## How to read this document

Items are grouped by where they sit relative to the current state of the
product, not by a fixed date. "Now" reflects active work visible in recent
history. "Next" is unstarted but scoped by an existing gap or stub in the
codebase. "Later" is a direction worth pursuing without a concrete plan yet.

## Delivered

The following are built and in production use, based on the module survey
in the [PRD](./PRD.md) and [TDD](./TDD.md):

- Core meeting lifecycle: agenda, roles, prepared speakers, table topics,
  attendance, timer, Ah-Counter, grammarian, pre-meeting checklist,
  published public agenda.
- Education tracking: Pathway progress, speech history, evaluations, and a
  term planner kept in sync with real meetings.
- Guest pipeline: kanban stages, contact and visit logs, conversion to
  membership without losing history.
- Club administration: roster management including bulk add, role and
  permission overrides, invites and join codes, club profile, audit trail.
- Finance: transactions, dues tracking, budget lines.
- Tasks, Inventory, Library (assets, documents, planner ideas), Records,
  Activity Logs.
- Organizational hierarchy: District, Division, Area views for directors,
  and a Super Admin console with direct user provisioning and credential
  handoff.
- Shared authorization engine (`@toastly/access`) enforcing the same
  permission logic on both frontend and backend.
- Multi-tenant Postgres backend with schema-enforced tenant isolation.
- CI/CD pipeline: lint, typecheck, test, migrate, deploy, smoke test,
  auto-rollback.
- PWA installability, offline screen, Web Push notifications.
- Public evaluation flow with text, image, and audio capture.
- Agenda banner customization (color and drag-positioned image).

## Now

Based on the most recent commits, active work is concentrated on:

- **Club Admin roster management.** Bulk and single member addition
  directly from the roster, most recently landed.
- **Meeting agenda visual customization.** Banner color and image
  positioning for the public agenda.
- **Public evaluation flow robustness.** Idempotency fixes so a replayed
  submission (for example, a flaky mobile connection retrying a request)
  does not create duplicate evaluations.

## Next

Gaps and stubs already visible in the codebase that are natural next steps:

- **Background job processing.** A queue module exists as a seam
  (`apps/api/src/queue/`) but is not backing real workloads yet. Candidates
  once needed: digest emails or push notifications for upcoming meetings,
  scheduled reminders for unpaid dues, batch cleanup of expired invites and
  join requests.
- **Redis-backed queue.** `REDIS_URL` is optional today specifically
  because nothing requires it yet; wiring an actual BullMQ (or equivalent)
  worker is the natural pairing with the queue seam above.
- **Deeper reporting.** The `report` resource already exists in the
  authorization engine's resource list, suggesting reporting was scoped as
  a feature but has no dedicated screens yet: term-over-term Pathway
  completion rates, attendance trends, dues collection status by period,
  guest conversion rate by stage and time.
- **Evaluation-form catalogue completeness.** The evaluation form download
  proxy exists; confirm it covers the full current Pathways project list as
  Toastmasters International updates `docs/pathway.json`.

## Later

Directions worth pursuing without a committed plan:

- **Toastmasters International integration.** Investigate whether Base
  Camp or another Toastmasters International system exposes an API that
  would let Pathway level and project data be pulled rather than entered by
  hand, reducing the risk of the two systems drifting apart.
- **Fuller offline support.** The current PWA intentionally stops short of
  full offline operation. If meeting-room connectivity turns out to be a
  recurring problem for clubs, precaching the agenda and enabling
  offline-first attendance marking (synced on reconnect) would be the next
  step, but this is a real architectural commitment, not a small addition.
- **Multi-region or read-replica deployment.** Not needed at current scale;
  worth revisiting only if latency or availability requirements change.
- **Native mobile app.** Currently a non-goal (see the PRD); revisit only
  if the PWA proves insufficient for a real usage pattern, not
  speculatively.
- **Real-time collaborative agenda editing.** Currently last-write-wins.
  Only worth the complexity if multiple officers editing the same agenda
  simultaneously turns out to be a frequent, painful occurrence in practice.

## Explicit non-goals

Carried forward from the PRD, restated here so they are not mistaken for
gaps to be filled:

- Replacing Toastmasters International's own membership-of-record system.
- Payment processing.
- A native mobile app, as distinct from the installable PWA.
