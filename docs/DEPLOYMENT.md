# Deployment

Single GitHub Actions workflow ([`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml))
builds and verifies on every push and PR, then deploys `main` to the VPS.

```
push to main
   └─ ci      install → build @toastly/access → lint → typecheck → test
              → restore Turbopack cache → build → save cache
              → bundle (pnpm deploy + Next standalone) → release.tar.gz
   └─ deploy  prisma migrate deploy (from the runner)
              → write shared/.env → scp tarball → remote-deploy.sh
              → atomic symlink flip → pm2 startOrReload
              → smoke test → roll back if it fails
```

Nothing is built on the VPS. The box needs no compiler, no `pnpm install`, and
no build-time RAM; a broken build can never take the site down because it never
reaches the release directory.

## Layout on the VPS

```
/srv/toastly/
  releases/<sha>/        api/ web/ ecosystem.config.cjs VERSION
  shared/.env            0600, written from GitHub secrets each deploy
  shared/ecosystem.config.cjs
  current -> releases/<sha>
  tmp/                   upload staging
```

`shared/` outlives releases. `current` is flipped with `mv -T`, a single
`rename(2)`, so no request ever sees a missing symlink. The last 5 releases are
kept for rollback.

## One-time setup

### 1. VPS

```bash
sudo mkdir -p /srv/toastly/{releases,shared,tmp}
sudo chown -R "$USER":"$USER" /srv/toastly

# Node must match the CI build — see the ABI note below. Whatever this prints
# is the version .nvmrc must have, not the other way around: match the box.
node --version
pm2 --version

# Let PM2 survive reboots.
pm2 startup systemd -u "$USER" --hp "$HOME"

# Log rotation — PM2 does not delete a process's logs when you `pm2 delete`
# it, and without this a runaway or crash-looping process fills the disk
# silently. Bit us once already during this project's own setup.
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

Reverse proxy: this deployment sits behind **Caddy**, not Nginx —
[`deploy/Caddyfile`](../deploy/Caddyfile) is a copy of the live
`/etc/caddy/Caddyfile`, kept here so routing changes are reviewed with the
code that needs them. It matters that the `@api` path matcher tracks Nest's
global prefix (`api`, set in `apps/api/src/main.ts`) — a stale matcher left
over from whatever ran on this box before is a silent 404, not a crash. After
editing the real file on the VPS:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

### 2. GitHub

Create an environment named **`production`** (Settings → Environments), then add:

| Secret              | Notes                                                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SSH_PRIVATE_KEY`   | Private half of a dedicated deploy keypair — don't reuse a personal key; generate one with `ssh-keygen`, append the `.pub` half to the deploy user's `authorized_keys`, and only the private half goes in here |
| `SSH_HOST`          | VPS hostname or IP                                                                                                                                                                                             |
| `SSH_USER`          | Whatever user owns `/srv/toastly` (e.g. `nifty`)                                                                                                                                                               |
| `DATABASE_URL`      | Managed Postgres. Set `connection_limit` deliberately — see below                                                                                                                                              |
| `JWT_ACCESS_SECRET` | ≥16 chars. Boot fails if it is still the `.env.example` placeholder                                                                                                                                            |
| `REDIS_URL`         | Only once Redis is live                                                                                                                                                                                        |

| Variable          | Value                       |
| ----------------- | --------------------------- |
| `CORS_ORIGINS`    | `https://your-domain`       |
| `JWT_ACCESS_TTL`  | optional, defaults to `15m` |
| `JWT_REFRESH_TTL` | optional, defaults to `30d` |

`API_URL` is not configurable per environment: it is fixed to
`http://127.0.0.1:4000` at build time (see below).

### 3. First deploy

Push to `main`. On the very first run there is no previous release, so a failed
smoke test leaves the new release in place for inspection rather than rolling
back — check `pm2 logs`.

## Things that will bite you if changed carelessly

**CI's Node major must match the VPS's, whatever that happens to be.** `argon2`
ships prebuilt binaries keyed to `NODE_MODULE_VERSION`, which is per major Node
version — a bundle built on one major crashes at require-time on a host running
a different one. This deployment runs Node 24 on the VPS, so
[`.nvmrc`](../.nvmrc) pins CI to 24 too — not because 24 is special, but because
that's what `node --version` reports on the box. If the VPS is ever
reprovisioned on a different major, `.nvmrc` has to move with it.

**`API_URL` is baked at build time.** Next serialises `rewrites()` into
`routes-manifest.json` during the build, so this cannot be changed by a restart
— only by a rebuild. It is loopback and both processes share a host, so this is
fine, but do not expect to retarget it via the environment.

**`cp -a`, never `cp -r`, for the standalone bundle.** The Next standalone tree
is a pnpm layout held together by ~29 symlinks. `cp -r` dereferences them,
tripling the size and turning `apps/web/node_modules/next` into a real
directory — after which Node cannot resolve `@swc/helpers` and the server dies
at startup. `cp -a` implies `--no-dereference --preserve=links`.

**`pnpm deploy` needs `--legacy`.** Since pnpm 10 the default path requires
`inject-workspace-packages=true`. We deliberately do not set that: injecting
turns workspace packages into copies and breaks the `tsc --watch` loop that
`pnpm dev` relies on for `@toastly/access`.

**`@toastly/access` must be built before anything else.** Its `dist/` is
gitignored and nothing in `pnpm install` produces it, so a clean checkout that
skips `pnpm build:packages` fails with ~39 `TS2307` errors. The root `build` and
`typecheck` scripts both run it first.

**PM2 cannot read the repo `.env`.** `ConfigModule`'s
`envFilePath: ['../../.env.local', '../../.env']` resolves against
`process.cwd()`, and PM2 resolves a symlinked `cwd` to its _physical_ path — so
on the VPS `../../` lands in `/srv/toastly/releases/`, not `/srv/toastly/`.
[`deploy/ecosystem.config.cjs`](../deploy/ecosystem.config.cjs) therefore parses
`shared/.env` itself and injects it through PM2's `env` block. `@nestjs/config`
tolerates the missing files and never overwrites an existing `process.env` key,
so dev is unaffected.

**Postgres connections are `instances × pool size`.** The ecosystem file runs 2
API workers. If you raise `instances`, raise or cap `connection_limit` in
`DATABASE_URL` to stay under your provider's pooler limit.

**Migrations run before the new code ships.** That ordering is deliberate — a
failed migration aborts the deploy while the old release is still serving,
untouched. The cost is that every migration must be backwards-compatible with
the release currently running: add columns and tables, backfill, and only drop
or rename in a _later_ deploy once nothing reads them (expand/contract). A
migration that drops a column the running code still selects will break
production during the window between migrate and reload — and rollback will not
save you, because rolling back the code does not roll back the schema.

**PM2 log files outlive `pm2 delete`.** They are not tied to the process
registration — `~/.pm2/logs/<name>-out.log` and `-error.log` just keep growing
until something rotates them, even after the app that wrote them is long gone.
This filled a 29G disk to 100% on this exact VPS before this pipeline's first
deploy, from logs belonging to an app removed weeks earlier. `pm2-logrotate`
(installed in the one-time setup above) caps this going forward; without it,
disk exhaustion is silent until a deploy fails with no free space to extract
into.

## How a bad deploy is caught

`remote-deploy.sh` polls `/api/health` and asserts three things:

1. it responds at all,
2. `"db":"up"` — a 200 with a dead database means up but useless,
3. `"version"` equals the SHA just deployed.

(3) is the important one: a PM2 worker still serving the previous release would
pass every other check, and the deploy would report success having shipped
nothing. The version comes from `APP_VERSION`, injected by the ecosystem file.

On failure the script flips `current` back to the previous release, reloads, and
exits non-zero. The bad release is left on disk for inspection.

### Manual rollback

```bash
ls -1t /srv/toastly/releases          # pick the previous SHA
ln -sfn /srv/toastly/releases/<sha> /srv/toastly/current.tmp
mv -Tf /srv/toastly/current.tmp /srv/toastly/current
APP_VERSION=<sha> pm2 startOrReload /srv/toastly/shared/ecosystem.config.cjs --update-env
```

## The build cache

Turbopack's filesystem build cache is **already enabled by default** in Next
16.3 (`experimental.turbopackFileSystemCacheForBuild`), which
[`next.config.ts`](../apps/web/next.config.ts) pins explicitly. CI does not turn
it on; it only makes `apps/web/.next/cache` survive between runners.

The cache step uses `actions/cache/restore` + `save` with `github.run_id` in the
save key rather than the usual combined action with a content hash. `actions/cache`
never overwrites an existing exact key, so a content-hash key freezes at the
first successful build and goes stale permanently. A unique key per run always
writes; `restore-keys` warm-starts from the most recent prior run.

**Check whether it is actually paying for itself.** The cache costs ~15–30s of
upload/download per run and the directory is ~176 MB locally. Compare the
`Build` step duration on a cold run against a warm one; if the delta is smaller
than the cache overhead, delete the two cache steps.

## Environments and Redis/BullMQ

`APP_ENV` (`development` | `production`) is the feature switch, deliberately
separate from `NODE_ENV` — the tooling forces `NODE_ENV=production` during
`next build` and under PM2, so it cannot express "production build, no Redis".

- **Local**: `APP_ENV=development`. No Redis, no BullMQ.
  [`QueueModule`](../apps/api/src/queue/queue.module.ts) binds a no-op
  `QueueService`.
- **Production**: `APP_ENV=production`. `REDIS_URL` becomes a hard boot
  requirement, enforced in
  [`env.validation.ts`](../apps/api/src/config/env.validation.ts).

Call sites inject the abstract `QueueService` and never branch on the
environment, so turning Redis on does not touch feature code.

To finish the Redis rollout:

1. Run Redis on the VPS (Docker), bound to `127.0.0.1` only.
2. Add `REDIS_URL` to the `production` environment secrets.
3. `pnpm --filter @toastly/api add bullmq`.
4. In `QueueModule.forRoot()`, register `BullModule` and bind a BullMQ-backed
   `QueueService` in the production branch.
5. Declare each job in the `JobPayloads` map. Until one exists, `JobName` is
   `never` and `enqueue()` is uncallable by construction.
