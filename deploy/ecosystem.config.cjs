/**
 * PM2 process definitions for the VPS.
 *
 * `.cjs` rather than `.js`: PM2 loads this with `require()`, and a bare `.js`
 * would be read as ESM if a `package.json` with `"type": "module"` ever lands
 * above it.
 *
 * Both apps run in **cluster** mode. This is load-bearing, not a performance
 * choice: `pm2 reload` is only genuinely zero-downtime under the cluster
 * scheduler, which starts a replacement worker and waits for it to listen
 * before retiring the old one. In fork mode `reload` degrades to a stop/start
 * and drops every in-flight request.
 *
 * ── Why this file reads the .env itself ──────────────────────────────────
 * The API resolves `envFilePath: ['../../.env.local', '../../.env']` relative
 * to `process.cwd()` (see app.module.ts). PM2 resolves a symlinked `cwd` to its
 * *physical* path, so on the VPS the process starts in
 * `/srv/toastly/releases/<sha>/api` and `../../` lands in
 * `/srv/toastly/releases/` — never `/srv/toastly/`. The app would therefore
 * find no env file at all and boot with an undefined JWT secret.
 *
 * So the env is loaded here, from the release-independent `shared/.env`, and
 * injected through PM2's `env` block. @nestjs/config tolerates the missing
 * files and never overwrites a key already present in `process.env`, so the
 * existing code path keeps working untouched in both dev and prod.
 */

const fs = require('node:fs');
const path = require('node:path');

// Overridable so the same file can drive a staging root, and so it can be
// exercised outside the VPS without a /srv mount.
const APP_ROOT = process.env.APP_ROOT || '/srv/toastly';
const SHARED_ENV = path.join(APP_ROOT, 'shared', '.env');

/** Minimal dotenv parser — avoids making PM2 depend on a node_modules that
 * lives inside a release directory that this file outlives. */
function readSharedEnv(file) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing ${file}. The deploy writes it from GitHub secrets before reloading PM2; ` +
        'refusing to start with an incomplete environment.',
    );
  }

  const env = {};
  for (const rawLine of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // Strip one layer of matching quotes, mirroring dotenv.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }
  return env;
}

const sharedEnv = readSharedEnv(SHARED_ENV);

module.exports = {
  apps: [
    {
      name: 'toastly-api',
      // `current` is a symlink flipped atomically by remote-deploy.sh. PM2 is
      // always reloaded with this config file so it re-resolves the symlink;
      // the deploy smoke test asserts /api/health reports the new APP_VERSION,
      // which is what catches a worker that somehow kept the old path.
      cwd: path.join(APP_ROOT, 'current', 'api'),
      script: 'dist/main.js',
      exec_mode: 'cluster',
      // Two workers is a deliberate ceiling, not a default: total Postgres
      // connections are instances x Prisma pool size, and a managed provider's
      // pooler caps that. Raise this and the connection_limit together.
      instances: 2,
      max_memory_restart: '512M',
      // Give in-flight requests room to drain after SIGINT before PM2 SIGKILLs.
      // Pair with app.enableShutdownHooks() in main.ts.
      kill_timeout: 10000,
      // Don't consider a worker "online" until it has actually listened.
      listen_timeout: 10000,
      wait_ready: false,
      env: {
        ...sharedEnv,
        NODE_ENV: 'production',
      },
    },
    {
      name: 'toastly-web',
      // Next standalone output: server.js sits under apps/web/ because the
      // build traces from the monorepo root (outputFileTracingRoot).
      cwd: path.join(APP_ROOT, 'current', 'web'),
      script: 'apps/web/server.js',
      exec_mode: 'cluster',
      instances: 2,
      max_memory_restart: '512M',
      kill_timeout: 10000,
      listen_timeout: 10000,
      env: {
        ...sharedEnv,
        NODE_ENV: 'production',
        PORT: '3000',
        // Bind loopback only — Nginx is the sole public entrypoint. Binding
        // 0.0.0.0 would expose Next directly on the VPS's public interface.
        HOSTNAME: '127.0.0.1',
      },
    },
  ],
};
