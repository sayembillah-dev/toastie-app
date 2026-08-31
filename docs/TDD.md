# Technical Design Document (TDD)

Status: living document, reconstructed from the shipped codebase on 2026-08-31.
Companion to [PRD.md](./PRD.md) and [ERD.md](./ERD.md).

## 1. Overview

Toastie is a pnpm monorepo with three workspace packages: a Next.js frontend,
a NestJS backend, and a shared authorization library used by both.

| Package           | Path              | Role                                                |
| ----------------- | ----------------- | --------------------------------------------------- |
| `@toastly/web`    | `apps/web`        | Next.js 16 App Router frontend                      |
| `@toastly/api`    | `apps/api`        | NestJS 11 REST API under a global `/api` prefix     |
| `@toastly/access` | `packages/access` | Isomorphic authorization engine shared by both apps |

Runtime: Node 24, pnpm 11 workspaces, TypeScript 5.9 across the whole repo.

## 2. Architecture

```
Browser
  |
  |  https://<host>
  v
Caddy  (TLS termination, compression, 25 MB request body cap)
  |
  +-- /api/*  --> 127.0.0.1:4000   NestJS   (PM2 cluster, 2 workers)
  |                                    |
  |                                    +--> PostgreSQL (via Prisma)
  |                                    +--> S3-compatible storage (presigned PUT/GET)
  |
  +-- /*      --> 127.0.0.1:3000   Next.js  (PM2 cluster, 2 workers)
```

The frontend proxies `/api/*` requests to the NestJS service (`next.config.ts`
rewrite), so the browser only ever talks to one origin. Both services run
under PM2 in cluster mode with two workers each, behind Caddy as the reverse
proxy and TLS terminator.

## 3. Frontend (`apps/web`)

- **Framework:** Next.js 16, App Router, React 19.
- **UI kit:** Ant Design 6 for components, Tailwind CSS 4 for layout and
  utility styling.
- **Data fetching:** Redux Toolkit Query (RTK Query) as the API client layer,
  with a dual server/browser fetch wrapper in `src/lib/api.ts` so the same
  calls work in server components and client components.
- **Routing structure:**
  - `app/(app)/`: authenticated routes: dashboard (route root), meetings
    and the meetings planner, education (per member), people and people
    members, library, inventory, finance, tasks, records, activity logs,
    club admin (members, permissions, profile, audit trail), area,
    division, district, super-admin (users, per-district, per-division),
    the signed-in user's own profile and password change screens.
  - `app/(public)/`: unauthenticated routes: login, register, invite
    acceptance, a one-time credentials page, and the public meeting
    surfaces (agenda, a single role, the evaluation form).
- **State:** Redux store (`src/store`) holds the RTK Query API slice plus a
  small number of UI slices. Most page state otherwise lives in server
  components and React state, not global Redux state.
- **Progressive web app:** a manifest, maskable icons, an offline screen
  built on Next's `useOffline` hook, and a push-only service worker
  (`public/sw.js`). The app is installable to a home screen. It is not
  precached for full offline use; a cold load with no network still fails.

## 4. Backend (`apps/api`)

- **Framework:** NestJS 11, modular by feature under `src/`.
- **ORM:** Prisma 6 against PostgreSQL. See [ERD.md](./ERD.md) for the full
  schema.
- **Password hashing:** Argon2id.
- **Authentication:** JWT access tokens plus rotating, hashed refresh
  tokens (see section 6).
- **File storage:** an S3-compatible backend behind presigned PUT/GET URLs,
  with a local-database fallback (`FILE_STORAGE_PROVIDER=local-db`) for
  environments without S3 configured.
- **Push notifications:** Web Push via VAPID keys, degrading to a no-op when
  unconfigured.
- **Background jobs:** a queue abstraction module exists as a seam for a
  future Redis/BullMQ-backed worker; it is not required for current
  functionality and `REDIS_URL` remains optional.
- **Boot-time validation:** `src/config/env.validation.ts` validates required
  environment variables before the process accepts traffic, so a
  misconfigured deploy fails fast instead of serving broken requests.

### 4.1 Module map

| Module                                                 | Responsibility                                                                                              |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `access/`                                              | Guards, subject construction, permission lineage cache, and a compile-time drift check against Prisma enums |
| `auth/`                                                | Register, login, refresh rotation, password change                                                          |
| `org/`                                                 | Districts, divisions, areas                                                                                 |
| `org-assignments/`                                     | Area/Division/District Director assignments                                                                 |
| `clubs/`, `memberships/`, `invites/`, `join-requests/` | Club CRUD, roster, invite links and codes, join requests                                                    |
| `meetings/`                                            | Agenda, role assignments, prepared speakers, table topics, attendance, the public meeting surface           |
| `education/`                                           | Pathway history and stats, evaluations received, planner rows, evaluation form downloads                    |
| `evaluations/`                                         | Member-facing and public (anonymous) evaluation submission                                                  |
| `people/`                                              | Guest/prospect CRUD, contact and visit logs                                                                 |
| `library/`                                             | Assets, documents, planner ideas                                                                            |
| `inventory/`                                           | Inventory items and the per-meeting checklist                                                               |
| `finance/`                                             | Transactions, dues records, budget lines                                                                    |
| `tasks/`                                               | Officer tasks, assignees, notes                                                                             |
| `activity/`                                            | Audit log                                                                                                   |
| `storage/`                                             | Presigned upload URLs, local-db fallback                                                                    |
| `push/`                                                | Web Push subscribe/send                                                                                     |
| `users/`                                               | Profile, memberships, credentials, public user lookups                                                      |
| `queue/`                                               | Background job abstraction (currently a stub seam)                                                          |

## 5. API surface

All routes are served under a global `/api` prefix. Grouped by feature:

- **Auth** (`auth`): register, login, refresh, logout, session, password
  change.
- **Users** (`users`, `profile`, `users/:userId/memberships`,
  `public/users`): user CRUD and status/admin flags, self profile, per-user
  memberships, public credential lookup.
- **Org hierarchy** (`districts`, `divisions`, `areas`,
  `users/:userId/org-assignments`): CRUD for the district tree and director
  assignments.
- **Clubs** (`clubs`, `org-clubs`): club directory, join code, "my club",
  join by code; director/admin CRUD over clubs.
- **Memberships** (`members`): roster CRUD, bulk add, status, admin flag,
  permission overrides.
- **Invites and join requests** (`invites`, `public/invites`,
  `join-requests`): create/revoke/accept invites, request-to-join workflow.
- **Meetings** (`meetings`, `.../roles`, `.../prepared-speakers`,
  `.../table-topics`, `.../attendance`, `public/meetings`): meeting CRUD and
  every meeting sub-resource, plus the unauthenticated public surface.
- **Education** (`members/:memberId`, `planner-rows`,
  `education/evaluation-forms`): history, stats, pathway, evaluations
  received, timer and Ah-Counter entries, speech slot requests, the term
  planner, evaluation form downloads.
- **Evaluations** (`members/:memberId`, `public/meetings/:meetingId/...`):
  received evaluations, and the public sign-and-submit evaluation flow.
- **People** (`guests`): guest CRUD, member matching, convert-to-member,
  contact logs, visit logs.
- **Library** (`assets`, `documents`, `planner/ideas` equivalents under
  `library`): CRUD for each.
- **Inventory** (`inventory-items`, `meetings/:meetingId/checklist`): CRUD
  for each.
- **Finance** (`transactions`, `dues-records`, `budget-lines`): CRUD and
  dues updates.
- **Tasks** (`tasks`, `members/:memberId/tasks`): task CRUD, per-member
  view, notes.
- **Activity** (`activity-logs`): read the audit feed.
- **Storage** (`uploads`): request a presigned upload URL.
- **Push** (`push`): subscribe/unsubscribe.
- **Health** (`health`): used by the deploy smoke test; reports database
  status and the deployed version.

## 6. Authentication

- Login is by phone number and password, not email. Email is an optional
  secondary contact field.
- Passwords are hashed with Argon2id.
- On login, the API issues a short-lived JWT access token (default 15
  minutes) and a longer-lived, opaque refresh token (default 30 days).
- Refresh tokens are never stored in plain text. Only their SHA hash is
  persisted, in the `RefreshToken` table, alongside a `familyId` that links
  every token issued from the same original login.
- Refreshing rotates the token: the old one is marked used, a new one is
  issued in the same family. If a refresh token is presented a second time
  (a sign of theft, since a legitimate client would already have rotated
  past it), the entire token family is revoked, forcing re-login on every
  device sharing that family.
- Newly provisioned users (created by an officer or Super Admin rather than
  self-registering) receive their first password through a one-time
  `CredentialShare` record, shared as a link or QR code, deleted on first
  login.

## 7. Authorization

Authorization is implemented once, in `@toastly/access`, and consumed
identically by NestJS guards on the backend and by UI code on the frontend
that decides what to render. There is a single grants table; the two layers
cannot drift from each other because they call the same function.

### 7.1 The `can` function

```
can(subject, action, resource, target) -> boolean
```

- **Actions:** `create`, `read`, `update`, `delete`.
- **Resources:** a closed set of 27 keys covering every module: `user`,
  `club`, `member`, `memberRole`, `memberPermission`, `education`,
  `meeting`, `meetingRole`, `checklist`, `tableTopic`, `attendance`,
  `guest`, `guestLog`, `library`, `inventory`, `transaction`, `budget`,
  `dues`, `evaluation`, `speechRequest`, `task`, `activityLog`, `invite`,
  `joinRequest`, `orgUnit`, `orgAssignment`, `report`.
- **Scopes**, ascending: `own < club < area < division < district < global`.
  A grant's effective scope is clamped to the subject's actual assignment
  anchor, so a misconfigured grants table cannot escalate a user past what
  their real assignment allows.
- **Subjects** carry one of: a club assignment (a specific club, the
  member's club roles, and any per-member `grantOverrides`), an org
  assignment (Area, Division, or District Director anchored to a specific
  unit), or global access (Super Admin, via the `isSuperAdmin` flag on
  `User`).

### 7.2 Enforcement points

- **Backend:** NestJS guards in `src/access/` build the subject from the
  authenticated user and the request's active context, then call `can`
  before a handler runs.
- **Frontend:** the same `can` function, given the same subject shape,
  decides what to render, so a user never sees a control for an action the
  backend would reject.
- **Active context:** an `X-Toastly-Context` header carries which club or
  org unit the request is acting within. A `ContextGuard` validates that
  header against the user's real assignments in the database and returns a
  flat 403 (`CONTEXT_NOT_HELD`) on mismatch, without leaking which contexts
  do exist.
- **Drift protection:** `src/access/roles.compat.ts` asserts, at compile
  time, that the Prisma `ClubRole`/`OrgRole` enum values are string-identical
  to the role unions used by `@toastly/access`. A mismatch fails the build
  rather than surfacing as an unexplained runtime 403 later.

### 7.3 Public surfaces

A small set of routes bypass authentication entirely, by design, because the
person on the other end is not expected to have an account:

- `GET public/meetings/:meetingId` and its role/agenda sub-routes
- `POST public/meetings/:meetingId/speakers/:speakerId/evaluations` (behind
  a lightweight identity "sign" step, not a login)
- `GET public/invites/:token`
- `GET public/users/:userId/credentials` (one-time credential handoff)

## 8. Data model and tenancy

See [ERD.md](./ERD.md) for the full schema. The short version: `Club` is the
tenant root. Nearly every operational table carries a `clubId`, and parent
tables expose a composite unique constraint of `(clubId, id)` so that child
tables can foreign-key on `(clubId, parentId)` rather than `id` alone. This
makes a cross-tenant reference a schema-level impossibility, not just an
application-level convention that a bug could violate.

`Membership`, not `User`, is the identity that almost everything else in a
club hangs off. A `Membership.userId` can be null: an officer can add
someone to the roster by name and phone number before that person has ever
signed up, and the row is claimed automatically the first time a new
account's phone number matches it.

## 9. File storage

Uploads (avatars, meeting evaluation media, library assets and documents,
inventory images) go through a presigned URL flow: the client asks the API
to sign a PUT, uploads directly to S3-compatible storage, and the API stores
the resulting object key. When `FILE_STORAGE_PROVIDER=local-db`, the same
interface is backed by storing the file directly in Postgres instead,
useful for environments without S3 configured. Reads go through a similarly
signed GET URL when the S3 backend is active.

## 10. Push notifications

Web Push, using VAPID keys. The frontend requests a subscription
(`PushSubscription`, one row per browser/device per user) and the backend
can send to any or all of a user's active subscriptions. If VAPID keys are
not configured, the subsystem no-ops rather than failing requests.

## 11. Migrations and schema evolution

The deploy pipeline runs `prisma migrate deploy` before the new application
code goes live (see [DEPLOYMENT.md](./DEPLOYMENT.md)). Because of that
ordering, schema changes must follow expand-now, contract-later discipline:
a column or table cannot be dropped in the same release that stops writing
to it, because the previous release's code may still be serving traffic
against the new schema for a short window during rollout.

## 12. Code quality and tooling

- **Linting/formatting:** Biome for JavaScript/TypeScript, plus an
  ESLint layer specific to Next.js conventions; Prettier for Markdown and
  YAML.
- **Type checking:** TypeScript 5.9, pinned at the workspace root so all
  three packages compile against the same compiler version.
- **Testing:** Vitest, currently exercising `@toastly/access` most heavily
  (`can.test.ts`).
- **Git hooks:** Husky plus lint-staged run formatting and linting on
  staged files before a commit is allowed to land.

## 13. Deployment

Covered in full in [DEPLOYMENT.md](./DEPLOYMENT.md). Summary: GitHub Actions
builds and tests on every push, and on push to `main` runs
`prisma migrate deploy`, ships a release bundle to a VPS over SSH, flips a
symlink atomically, reloads both PM2 process groups, and runs a smoke test
against `/api/health` that checks both database connectivity and that the
deployed version matches the intended commit, rolling back automatically on
failure.

## 14. Known limitations

- No true offline mode; the PWA improves installability and gives a
  graceful offline screen, not offline data access.
- No real-time multi-user editing conflict resolution.
- Background job processing is stubbed, not yet backing real asynchronous
  workloads.
- Single-region deployment; no documented multi-region or read-replica
  setup.
