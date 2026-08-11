# Toastie

Club management for Toastmasters clubs. Toastie covers the full operating surface of a
club: meeting agendas and role assignments, member education and Pathways progress,
guest pipelines, finance, inventory, tasks, and the district hierarchy that sits above
it all.

The product ships to users as **Toastie**. Internally the workspace and its packages use
the `@toastly/*` namespace, and the PM2 processes on the server are named `toastly-api`
and `toastly-web`.

- **Frontend:** Next.js 16 (App Router), React 19, Ant Design 6, Tailwind CSS 4, Redux Toolkit Query
- **Backend:** NestJS 11, Prisma 6, PostgreSQL
- **Shared:** `@toastly/access`, an isomorphic authorization engine used by both apps
- **Runtime:** Node 24, pnpm 11 workspaces

---

## Table of contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Authorization model](#authorization-model)
- [Data model and tenancy](#data-model-and-tenancy)
- [File storage](#file-storage)
- [Push notifications](#push-notifications)
- [Code quality](#code-quality)
- [Deployment](#deployment)
- [Repository layout](#repository-layout)
- [Conventions worth knowing](#conventions-worth-knowing)

---

## What it does

Every module below is gated by the shared permission engine, so a plain member and a
club treasurer see materially different applications.

| Module              | Scope                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Dashboard           | Next meeting countdown, club pulse, personal lineup, recent activity, last speech                                       |
| Meetings            | Agenda builder, role assignments, prepared speakers, table topics, attendance, timer, Ah-Counter, grammarian, checklist |
| Education           | Pathways enrolment and progress, speech history, evaluation records, the speech planner                                 |
| Library             | Documents, media assets, and the meeting theme and idea planner                                                         |
| People              | Guest pipeline (kanban), contact and visit logs, member engagement profiles                                             |
| Inventory           | Club equipment register plus the per-meeting setup checklist                                                            |
| Tasks               | Officer-created tasks, assignees, notes, and personal task views                                                        |
| Finance             | Transactions, budget lines, dues tracking, and an overview ledger                                                       |
| Records             | Historical meeting and member records                                                                                   |
| Activity Logs       | Append-only audit feed of who changed what                                                                              |
| Club Admin          | Roster management, role and permission overrides, invites, join codes, club profile, audit trail                        |
| District operations | District, division, and area screens for directors, plus a Super Admin console over all of it                           |

### Public, unauthenticated surfaces

Some pages are deliberately reachable without a login, so that guests and visiting
speakers can be handed a link:

- `/meetings/:id/agenda` published meeting agenda
- `/meetings/:id/roles/:role` a single role's brief, shared with whoever is filling it
- `/meetings/:id/evaluate/:speakerId` evaluation capture (text, image, or audio) behind a lightweight identity gate
- `/invite/:token` invite landing and acceptance, with a generated Open Graph image
- `/credentials/:userId` a shareable credentials page

### Progressive web app

The web app ships a manifest, maskable icons, an offline screen driven by Next's
`useOffline`, and a push-only service worker. It installs to a home screen and runs
standalone. It is not a fully precached offline app: a cold load with no network still
fails at the browser level.

---

## Architecture

```
Browser
  |
  |  https://<host>
  v
Caddy  (TLS, compression, 25MB body cap)
  |
  +-- /api/*  --> 127.0.0.1:4000   NestJS   (PM2 cluster, 2 workers)
  |                                    |
  |                                    +--> PostgreSQL (Prisma)
  |                                    +--> S3 (presigned PUT/GET)
  |
  +-- /*      --> 127.0.0.1:3000   Next.js  (PM2 cluster, 2 workers)
```

Three workspace packages:

| Package           | Path              | Port | Role                                         |
| ----------------- | ----------------- | ---- | -------------------------------------------- |
| `@toastly/web`    | `apps/web`        | 3000 | Next.js App Router frontend                  |
| `@toastly/api`    | `apps/api`        | 4000 | NestJS REST API under a global `/api` prefix |
| `@toastly/access` | `packages/access` | n/a  | Permission engine shared by both apps        |

### How the apps talk

The browser never calls port 4000 directly. `next.config.ts` rewrites `/api/:path*` to
`${API_URL}/api/:path*`, so client code always requests a relative `/api` path and CORS
never enters the picture in development. Nest additionally allows the origins listed in
`CORS_ORIGINS` as a fallback for direct calls.

`apps/web/src/lib/api.ts` handles both sides of that split: on the server it calls Nest
directly at `API_URL`, in the browser it uses the relative path. Client data fetching
runs through RTK Query (`apps/web/src/store/api.ts`) with a routed base query that attaches the
bearer token and the active club context header.

`API_URL` is read at **build** time. Next serializes rewrites into
`routes-manifest.json`, so changing it requires a rebuild, not a restart.

### `@toastly/access` is shared on purpose

The same `can(subject, action, resource, target)` function decides whether a NestJS
guard admits a request and whether the frontend renders a nav item or a button. There is
one grants table, so the UI cannot drift from what the API will actually permit. The
package is pure TypeScript with no runtime dependencies and is covered by Vitest.

Its `dist/` is gitignored and nothing in `pnpm install` produces it. Both the root
`build` and `typecheck` scripts run `build:packages` first for that reason.

---

## Getting started

### Prerequisites

- **Node 24.** Pinned in `.nvmrc`. This is not cosmetic: `argon2` ships prebuilt binaries keyed to `NODE_MODULE_VERSION`, which changes with each Node major, so a mismatch fails at require time.
- **pnpm 11.17.0.** Declared in the root `packageManager` field; use Corepack.
- **PostgreSQL.** A local instance, or a hosted one such as Neon or Supabase.

### Install and run

```bash
pnpm install
cp .env.example .env          # then fill in DATABASE_URL and JWT_ACCESS_SECRET
pnpm --filter @toastly/api prisma:migrate
pnpm --filter @toastly/api prisma:seed
pnpm dev
```

`pnpm dev` starts the shared package's `tsc --watch`, the API, and the frontend together
via `concurrently`, with prefixed colour-coded output. It runs with `-k`, so stopping one
process (Ctrl-C) tears down the others.

- Frontend: <http://localhost:3000>
- API: <http://localhost:4000/api>
- Health check: <http://localhost:4000/api/health>

### Seeding

`apps/api/prisma/seed.ts` generates realistic volume: roughly 100 clubs, 1,000 users, and
2,500 memberships, completing in under a minute against a free-tier database. It reuses a
single argon2 hash for the shared development password, pre-generates cuid2 identifiers in
JavaScript so child rows never need a read-back, and chunks inserts at 5,000 rows.

The seed also upserts the super admin account from `SUPER_ADMIN_PHONE` and
`SUPER_ADMIN_PASSWORD`. Those variables are mandatory; the seed refuses to run without
them rather than leaving an environment with no administrator. Rotate the password by
editing `.env` and re-seeding.

---

## Environment variables

One `.env` at the repository root serves the whole monorepo. `apps/api` loads it through
`ConfigModule.forRoot`, `apps/web` through an explicit `dotenv` call in `next.config.ts`.
Do not add per-app env files. An optional `.env.local` takes priority over `.env` for
both apps.

Configuration is validated at boot by `apps/api/src/config/env.validation.ts`. Invalid or
missing values throw before any module is instantiated, which turns a silently undefined
JWT secret into a crash loop the process manager reports immediately.

### Required

| Variable              | Notes                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | Pooled Postgres connection string used by the running application                                          |
| `DIRECT_DATABASE_URL` | Unpooled connection, used only by `prisma migrate`. See the note below                                     |
| `JWT_ACCESS_SECRET`   | Minimum 16 characters. Boot fails if it is still the `.env.example` placeholder while `APP_ENV=production` |

### Common

| Variable               | Default                 | Notes                                                                        |
| ---------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| `APP_ENV`              | `development`           | `development` or `production`. The switch for infrastructure-backed features |
| `API_URL`              | `http://localhost:4000` | Read at build time by the Next rewrite                                       |
| `PORT`                 | `4000`                  | API listen port                                                              |
| `CORS_ORIGINS`         | `http://localhost:3000` | Comma-separated allowlist. Required when `APP_ENV=production`                |
| `JWT_ACCESS_TTL`       | `15m`                   | Access token lifetime                                                        |
| `JWT_REFRESH_TTL`      | `30d`                   | Refresh token lifetime                                                       |
| `SUPER_ADMIN_PHONE`    | none                    | Read by the seed only                                                        |
| `SUPER_ADMIN_PASSWORD` | none                    | Read by the seed only                                                        |

`APP_ENV` is deliberately distinct from `NODE_ENV`. The tooling owns `NODE_ENV`, since
`next build` and PM2 both force it to `production`, so it cannot express "a production
build running on a laptop with no Redis reachable".

`DIRECT_DATABASE_URL` exists because `prisma migrate deploy` holds a session-scoped
advisory lock, which requires every statement to land on the same backend connection. A
transaction-pooling PgBouncer endpoint cannot guarantee that, and the lock wait times out
with `P1002` while the server is perfectly reachable. On Neon this is the same host with
`-pooler` removed. Against local Postgres it can simply repeat `DATABASE_URL`.

### Optional subsystems

| Variable                       | Notes                                                        |
| ------------------------------ | ------------------------------------------------------------ |
| `REDIS_URL`                    | Validated for shape when present. Not yet required           |
| `FILE_STORAGE_PROVIDER`        | `local-db` (default) or `s3`                                 |
| `AWS_REGION`                   | Required when the provider is `s3`                           |
| `AWS_S3_BUCKET`                | Required when the provider is `s3`                           |
| `AWS_ACCESS_KEY_ID`            | Required when the provider is `s3`                           |
| `AWS_SECRET_ACCESS_KEY`        | Required when the provider is `s3`                           |
| `S3_SIGNED_GET_TTL_SECONDS`    | Defaults to 900                                              |
| `S3_SIGNED_PUT_TTL_SECONDS`    | Defaults to 300                                              |
| `VAPID_PUBLIC_KEY`             | Web Push signing key                                         |
| `VAPID_PRIVATE_KEY`            | Web Push signing key                                         |
| `VAPID_SUBJECT`                | Contact URI, conventionally `mailto:you@example.com`         |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Must equal `VAPID_PUBLIC_KEY`. Baked into the browser bundle |

`.env.example` documents each of these in full, including the S3 bucket policy and CORS
requirements.

---

## Scripts

Run from the repository root.

| Script              | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `pnpm dev`          | Shared package watcher, API, and frontend together               |
| `pnpm dev:web`      | Frontend only                                                    |
| `pnpm dev:api`      | Backend only                                                     |
| `pnpm build`        | Builds `@toastly/access`, then the API, then the frontend        |
| `pnpm start`        | Runs both production builds                                      |
| `pnpm lint`         | Biome across the repo, plus ESLint for the Next app              |
| `pnpm lint:fix`     | The same, with autofix                                           |
| `pnpm format`       | Biome for code, Prettier for Markdown and YAML                   |
| `pnpm format:check` | Formatting check without writing                                 |
| `pnpm typecheck`    | Builds shared packages, then `tsc --noEmit` across the workspace |
| `pnpm test`         | Vitest suite for `@toastly/access`                               |
| `pnpm clean`        | Removes `dist`, `.next`, and every `node_modules`                |

Target one package with `pnpm --filter @toastly/web <script>`.

### Database

| Script                                        | What it does                             |
| --------------------------------------------- | ---------------------------------------- |
| `pnpm --filter @toastly/api prisma:generate`  | Regenerate the Prisma client             |
| `pnpm --filter @toastly/api prisma:migrate`   | Create and apply a development migration |
| `pnpm --filter @toastly/api prisma:studio`    | Open Prisma Studio                       |
| `pnpm --filter @toastly/api prisma:seed`      | Seed the database                        |
| `pnpm --filter @toastly/api backfill:storage` | Move inline files into S3                |

---

## Authorization model

Authorization is a single pure function, `can(subject, action, resource, target)`, backed
by a static grants table. Resources are a closed union of 27 keys (`meeting`, `member`,
`transaction`, `orgUnit`, and so on), actions are `create | read | update | delete`, and
scopes ascend `own < club < area < division < district < global`.

### Subjects and assignments

A subject carries a list of assignments, each of which anchors their reach:

- **Club assignment:** a specific club, a set of club roles (`President`, `Treasurer`, `VPEducation`, `SergeantAtArms`, `ClubAdmin`, and others), and per-member permission overrides
- **Org assignment:** an `AreaDirector`, `DivisionDirector`, or `DistrictDirector` role anchored to a specific area, division, or district
- **Global assignment:** the Super Admin bypass

### The anchor is a ceiling

A grant whose scope is wider than its assignment's anchor is clamped down. A club role
can never produce cross-club reach regardless of what the grants table says. An org role
never widens past its own unit type. This is what makes the grants table safe to edit:
adding a broad grant to a club role cannot leak across tenants.

### Request context

Authenticated requests may carry an `X-Toastly-Context` header naming the club or org
unit the caller is acting within. `ContextGuard` validates that header against the
assignments the database actually reports, and answers a mismatch with a flat 403
`CONTEXT_NOT_HELD` that reveals nothing about what the caller does hold. The validated
context also supplies the lineage used to enrich permission targets, so a director who
drills into a club they hold no membership in still matches on their area, division, or
district grant.

### Drift protection

Prisma enum values are string-identical to the `@toastly/access` unions. A compile-time
assertion in `apps/api/src/access/roles.compat.ts` runs as a side-effect import at module
load, so a rename in one place fails the boot rather than surfacing later as a
mysterious 403.

### Authentication

Access tokens are JWTs with a short default lifetime, because a token stealable via XSS
should expire quickly. Refresh tokens are opaque random strings, SHA-hashed into a
`RefreshToken` row rather than signed, which is why there is no `JWT_REFRESH_SECRET`.
Refresh tokens rotate on use and are family-tracked: presenting an already-revoked token
is treated as a stolen credential and revokes the entire lineage, forcing a fresh login.
Passwords are hashed with argon2id.

---

## Data model and tenancy

`Club` is the tenant. Each club row denormalizes its `areaId`, `divisionId`, and
`districtId`, so scope resolution never needs a recursive query. `Membership` is one row
per (user, club) pair, and its `userId` is nullable so a club admin can populate a roster
before those people have signed up.

The operational tables carry composite tenant foreign keys via `@@unique([clubId, id])`,
which makes a cross-tenant reference physically impossible at the database level rather
than merely discouraged in application code.

The Prisma client generator emits both the `native` engine and `debian-openssl-3.0.x`.
CI builds on Ubuntu and ships to an Ubuntu server, so relying on `native` alone would
bake in the build machine's engine and break the moment the runner image and the server
diverge.

---

## File storage

Uploads run through one interface with two interchangeable backends, selected by
`FILE_STORAGE_PROVIDER`:

- **`local-db` (default).** Bytes are base64-encoded into the owning row's text column. It needs no infrastructure at all, which is the point: a fresh clone runs with nothing but Postgres.
- **`s3`.** One object per file. The row stores only the key.

On the S3 path no bytes move through the API process. The browser receives a presigned
`PUT` and uploads directly; reads come back as presigned `GET` URLs embedded in API
responses. The bucket must therefore block public access, so a leaked URL stops working
once its signature expires.

Presigned reads are also why the serializers are async. An app-side `/files/:id` redirect
cannot work here: authentication is a bearer token, and an `<img src>` sends no
`Authorization` header. A presigned URL carries its own credentials in the query string.

Switching to `s3` makes all four `AWS_*` variables mandatory. A half-configured bucket is
the dangerous state, because it fails at the first upload in front of a user instead of
at boot. Existing inline rows keep working after the switch;
`apps/api/prisma/backfill-storage.ts` migrates them across.

---

## Push notifications

Web Push is implemented end to end: `apps/api/src/push` signs and sends, and
`apps/web/src/lib/push` plus a push-only service worker handle subscription in the
browser. Subscribing and unsubscribing work with no keys configured; `PushService.send()`
simply no-ops until VAPID keys are present, so the feature degrades quietly rather than
failing boot.

Generate a key pair with:

```bash
pnpm dlx web-push generate-vapid-keys
```

`VAPID_PUBLIC_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` must hold the same value. One is
read server side to sign the push, the other is baked into the browser bundle to create
the subscription.

---

## Code quality

| Tool     | Responsibility                                                     |
| -------- | ------------------------------------------------------------------ |
| Biome    | Formatting, linting, and import organization for JS, TS, JSON, CSS |
| ESLint   | Next.js-specific rules for `apps/web`, zero warnings tolerated     |
| Prettier | Markdown and YAML only                                             |
| Vitest   | Unit tests for the permission engine                               |
| Husky    | Pre-commit hook running lint-staged                                |

The pre-commit hook runs lint-staged with `--concurrent false`, deliberately: Biome
rewrites staged files and ESLint reads them back, so parallel execution would race on the
same paths. When any file under `apps/api/src` or `apps/api/prisma` is staged, the hook
additionally regenerates the Prisma client and typechecks the API, which catches schema
drift that would otherwise appear as a wall of type errors for whoever pulls next. The
hook exits immediately under CI, where the full tree is checked anyway.

---

## Deployment

A single GitHub Actions workflow (`.github/workflows/ci-cd.yml`) builds and verifies
every push and pull request, then deploys `main` to a VPS.

```
push to main
  |
  +-- ci      install -> build @toastly/access -> lint -> typecheck -> test
  |           -> validate Prisma schema -> restore build cache -> build
  |           -> bundle (pnpm deploy + Next standalone) -> release.tar.gz
  |
  +-- deploy  prisma migrate deploy (from the runner)
              -> write shared/.env -> upload tarball -> remote-deploy.sh
              -> atomic symlink flip -> pm2 startOrReload
              -> smoke test -> roll back on failure
```

Nothing is built on the server. It needs no compiler, no `pnpm install`, and no
build-time memory, and a broken build can never take the site down because it never
reaches the release directory.

The `deploy` job reuses the exact artifact `ci` produced, so what was tested is what
ships. Releases are unpacked to `/srv/toastly/releases/<sha>` and activated by flipping a
`current` symlink with `mv -T`, a single `rename(2)`, so no request ever observes a
missing path. The last five releases are retained for rollback.

### How a bad deploy is caught

`deploy/remote-deploy.sh` polls `/api/health` and asserts three things: that it responds,
that `db` reports `up`, and that `version` equals the commit just deployed. The third
check is the important one. A PM2 worker still serving the previous release would pass
every other check, and the deploy would report success having shipped nothing. On failure
the script flips `current` back, reloads, and exits non-zero, leaving the bad release on
disk for inspection.

### Migrations run before the new code

That ordering is deliberate: a failed migration aborts the deploy while the previous
release is still serving traffic, untouched. The cost is that every migration must be
backwards compatible with the release currently running. Expand now, contract later. A
migration that drops a column the running code still selects will break production during
the window between migrating and reloading, and rolling back the code will not save you,
because it does not roll back the schema.

`docs/DEPLOYMENT.md` is the full operational reference: one-time server setup, the
required secrets and variables, the Caddy configuration, manual rollback, the build cache
tradeoff, and the pending Redis and BullMQ rollout.

---

## Repository layout

```
toastie-app/
├── apps/
│   ├── api/                        NestJS
│   │   ├── prisma/
│   │   │   ├── schema.prisma       Tenancy shape and all models
│   │   │   ├── migrations/
│   │   │   ├── seed.ts             Volume seed plus super admin bootstrap
│   │   │   └── backfill-storage.ts Inline files to S3
│   │   └── src/
│   │       ├── main.ts             Bootstrap, /api prefix, CORS, validation, shutdown hooks
│   │       ├── app.module.ts       Module wiring and env validation
│   │       ├── access/             Guards, subject factory, lineage cache, drift check
│   │       ├── auth/               Login, register, refresh rotation, password change
│   │       ├── config/             Environment schema and boot-time validation
│   │       ├── prisma/             Prisma module and service
│   │       ├── storage/            Two-backend file storage and upload signing
│   │       ├── queue/              Background job abstraction
│   │       ├── push/               Web Push subscriptions and delivery
│   │       ├── org/                Districts, divisions, areas
│   │       ├── clubs/  memberships/  invites/  join-requests/
│   │       ├── meetings/           Agenda, roles, speakers, table topics, attendance
│   │       ├── education/          Pathways, history, planner rows
│   │       ├── people/  library/  inventory/  finance/  tasks/
│   │       ├── activity/           Audit log
│   │       └── users/              Profile, memberships, public credentials
│   └── web/                        Next.js
│       ├── next.config.ts          API proxy, standalone output, security headers
│       └── src/
│           ├── app/
│           │   ├── (app)/          Authenticated routes
│           │   └── (public)/       Login, invites, public agendas, evaluations
│           ├── components/         Feature-grouped UI
│           ├── lib/                Domain logic and API types
│           └── store/              Redux Toolkit Query client and slices
├── packages/
│   └── access/                     Shared permission engine, Vitest covered
├── deploy/
│   ├── Caddyfile                   Mirror of the live reverse proxy config
│   ├── ecosystem.config.cjs        PM2 process definitions
│   └── remote-deploy.sh            Atomic swap, reload, smoke test, rollback
├── docs/DEPLOYMENT.md
├── .github/workflows/ci-cd.yml
└── pnpm-workspace.yaml
```

---

## Conventions worth knowing

**Tailwind and Ant Design coexist without overrides.** Tailwind v4 puts its reset in
`@layer base`, and Ant Design injects its styles unlayered at runtime. Unlayered CSS
always beats layered CSS, so antd components keep their own styling while preflight only
affects plain markup. `AntdRegistry` in `apps/web/src/components/antd-provider.tsx` collects
css-in-js output during SSR so the first paint is already styled, and `ConfigProvider`
holds the design tokens. Tailwind's matching palette lives in the `@theme` block in
`apps/web/src/app/globals.css`.

**TypeScript is pinned to 5.9.3 workspace-wide.** The NestJS 11 CLI is built against it.

**Build shared packages before anything else.** `packages/access/dist` is gitignored and
`pnpm install` does not produce it. A clean checkout that skips `pnpm build:packages`
fails with dozens of `TS2307` errors. The root `build` and `typecheck` scripts already
run it first.

**`pnpm deploy` requires `--legacy`.** Since pnpm 10 the default path expects
`inject-workspace-packages=true`, which this repository intentionally does not set,
because injecting turns workspace packages into copies and breaks the `tsc --watch` loop
that `pnpm dev` relies on.

**Copy the Next standalone tree with `cp -a`, never `cp -r`.** The standalone output is a
pnpm layout held together by symlinks. `cp -r` dereferences them, which triples the size
and turns `apps/web/node_modules/next` into a real directory, after which Node cannot
resolve `@swc/helpers` and the server dies at startup.

**Postgres connections are workers multiplied by pool size.** The PM2 ecosystem file runs
two API workers. Raising `instances` means raising or capping `connection_limit` in
`DATABASE_URL` to stay under the provider's pooler limit.

**Both apps run in PM2 cluster mode.** This is load-bearing rather than a performance
choice: `pm2 reload` is only genuinely zero-downtime under the cluster scheduler, which
starts a replacement worker and waits for it to listen before retiring the old one. In
fork mode it degrades to a stop and start, dropping every in-flight request. It pairs
with `app.enableShutdownHooks()` in `main.ts`, without which Nest never runs
`onModuleDestroy` and Prisma's pool is torn down by process death instead of being closed.

**Commits carry no AI attribution.** See `CLAUDE.md`. The contributors list must reflect
people only.
