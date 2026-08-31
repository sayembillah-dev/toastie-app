# Implementation Plan

Status: living document, written 2026-08-31. Covers how to build the items
listed under "Next" in [ROADMAP.md](./ROADMAP.md), and the conventions any
new feature in this codebase should follow to stay consistent with what is
already built. See [TDD.md](./TDD.md) for the architecture these steps
assume, and [ERD.md](./ERD.md) for the schema.

## 1. Conventions every new feature should follow

Before planning a specific feature, these are the load-bearing patterns
already established in the codebase. Deviating from them creates
inconsistency the rest of the team has to work around.

1. **Tenant scoping.** Any new table that belongs to a club must carry a
   `clubId` column. If it will have children, add the
   `@@unique([clubId, id])` constraint so children can foreign-key on
   `(clubId, parentId)`. This is not optional cleanup, it is the mechanism
   that prevents cross-tenant data leakage.
2. **Authorization through `@toastly/access`.** A new resource that needs
   permission checks gets a key added to the closed resource union in
   `packages/access`, not a one-off check written directly in a controller
   or a page. Both the NestJS guard and the frontend render logic should
   consume the same `can()` call.
3. **Expand-now, contract-later migrations.** Because `prisma migrate
deploy` runs before new code is live (see
   [DEPLOYMENT.md](./DEPLOYMENT.md)), a migration that removes a column or
   table must land in a release after nothing reads or writes it anymore,
   never in the same release.
4. **Membership, not User, as the anchor.** If a new feature attributes
   something to a person within a club, foreign-key it to `Membership`, not
   `User`, so it works for roster rows that have not been claimed by a
   signed-up account yet.
5. **Public routes are the exception, not the default.** A new public,
   unauthenticated endpoint should be added deliberately, under
   `public/...`, and should be re-examined for what it leaks (see the
   `ContextGuard` pattern of returning flat errors with no information
   disclosure).

## 2. Background job processing

**Goal:** turn the existing `apps/api/src/queue/` seam into a real worker,
so features that should not block a request (reminders, digests, batch
cleanup) have somewhere to run.

**Steps:**

1. Confirm `REDIS_URL` provisioning for each environment (local, CI,
   staging if one exists, production) before writing worker code, since the
   env validation module currently treats it as optional.
2. Pick a queue library (BullMQ is the natural fit given the existing
   `queue/` module's shape and the project's Node/TypeScript stack) and
   wire a producer/consumer pair behind the current queue module's
   interface, so callers that already exist do not need to change.
3. Add a dedicated PM2 process (or a `--worker` mode of the existing API
   process) so the worker runs independently of the two API web workers and
   can be scaled or restarted separately.
4. Ship one real job end-to-end before generalizing further, to prove the
   plumbing: the smallest, most clearly useful candidate is a scheduled
   reminder push notification the day before a published meeting, since
   push infrastructure (`push/`) already exists and only needs a scheduler
   in front of it.
5. Add a health/observability signal (job success/failure counts, queue
   depth) to `health.controller.ts` or a dedicated admin view, so a stuck
   queue is visible before it becomes a support problem.

**Sequencing note:** do this before dues reminders or digest emails below,
since both depend on it.

## 3. Dues and meeting reminders (first real jobs)

**Goal:** use the new queue to close a known gap: nothing currently
reminds a member their dues are due, or reminds an assigned role holder or
speaker their meeting is coming up.

**Steps:**

1. Dues reminder: a scheduled job that scans `DuesRecord` rows nearing or
   past a due point with `amountPaidMinor < amountDueMinor` and not
   `waived`, and sends a push notification (falling back silently if the
   member has no active `PushSubscription`, consistent with how the push
   subsystem already degrades).
2. Meeting reminder: a scheduled job keyed off `Meeting.dateTime`, notifying
   members with a `MeetingRoleAssignment` or `MeetingSpeaker` slot in the
   upcoming meeting.
3. Both should be idempotent per (job type, target, meeting/period) so a
   worker restart cannot double-send. The recent evaluation-submission
   idempotency fix is a useful reference for the pattern already accepted
   in this codebase.
4. Add an opt-out at the `Membership` or `User` level if this is not
   already assumed to be always-on; do not ship a notification feature
   without a way to turn it off.

## 4. Reporting

**Goal:** the `report` resource already exists in the authorization
engine's resource list; there are no reporting screens behind it yet.

**Steps:**

1. Scope the first report narrowly rather than building a generic
   reporting framework. Reasonable first candidates, in priority order:
   - Dues collection status by period, since Treasurer already has the
     underlying `DuesRecord` data and this is the most concrete, immediately
     actionable report.
   - Attendance trend by meeting over a term, since `MeetingAttendance` and
     `MeetingGuestAttendance` already capture the raw data.
   - Guest pipeline conversion rate by stage over time, since `Prospect`
     already tracks `stage`, `firstVisit`, `lastVisit`.
2. Build each report as a read-only, aggregation-only endpoint scoped by
   the existing `can(subject, 'read', 'report', target)` check, reusing the
   club/org scoping already established for every other resource. Do not
   introduce a parallel scoping mechanism for reports.
3. Prefer computing aggregates on read (as Finance's budget "planned vs
   actual" already does) over introducing new denormalized summary tables,
   unless a specific report proves too slow to compute live at the data
   volumes actually seen in production.
4. Surface reports under the existing Club Admin or Records navigation
   rather than inventing a new top-level module, unless usage patterns
   later show they need their own space.

## 5. Evaluation form catalogue completeness

**Goal:** confirm `education/evaluation-forms` covers the current
Toastmasters Pathways project list.

**Steps:**

1. Diff the forms currently served against the levels and projects present
   in `docs/pathway.json`.
2. Where `docs/pathway.json` itself may be stale relative to Toastmasters
   International's published Pathways catalogue, establish who owns
   updating it and how often, since it is hand-maintained data external to
   the app's own schema.
3. Add a lightweight automated check (even a CI script comparing the two
   lists) so a future Pathways catalogue update does not silently leave a
   gap between what `pathway.json` lists and what the download proxy
   serves.

## 6. General approach to picking up "Later" roadmap items

The "Later" items in the roadmap (Toastmasters International integration,
fuller offline support, multi-region deployment, a native mobile app,
real-time collaborative editing) are deliberately not scoped into concrete
steps here, because each is a real architectural commitment, not an
incremental addition. Before planning any of them:

1. Confirm the motivating problem is actually recurring in real usage, not
   hypothetical. The PRD's non-goals exist because these are easy to want
   in the abstract and expensive to build.
2. Write a short problem statement and get it into the PRD's open questions
   or goals section before writing an implementation plan for it, so the
   plan has a clear target to be judged against.
3. Re-run the tenancy and authorization conventions in section 1 against
   the new architecture before building, since a new sync layer (offline),
   a new client (native mobile), or a new region introduces new places
   those invariants could be violated.
