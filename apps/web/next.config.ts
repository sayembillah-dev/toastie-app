import path from 'node:path';
import { config } from 'dotenv';
import type { NextConfig } from 'next';

// A single .env lives at the repo root, shared with apps/api — see
// app.module.ts's ConfigModule.forRoot. Next.js only auto-loads .env files
// from its own project root (this directory), so the root file is loaded
// explicitly here, before anything reads process.env.API_URL below.
// dotenv never overwrites a key already in process.env, so .env.local
// (gitignored, optional) takes priority over .env when both set the same key.
config({ path: path.resolve(__dirname, '../../.env.local') });
config({ path: path.resolve(__dirname, '../../.env') });

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
// Public by nature (sent to every browser as part of the Web Push
// handshake) — safe to inline into the client bundle. Unset until VAPID
// keys are generated; `push-notifications.ts` treats that as "unsupported".
const NEXT_PUBLIC_VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['antd', '@ant-design/icons', '@ant-design/nextjs-registry'],

  // Emit `.next/standalone` — a self-contained tree (server.js + a real
  // node_modules) that runs under PM2 without a `pnpm install` on the VPS.
  output: 'standalone',

  // Tracing otherwise defaults to this package's directory and stops there,
  // which is wrong in a pnpm workspace: real dependency files live in the
  // root `node_modules/.pnpm` store and are reached through symlinks that
  // point above apps/web. Tracing from the repo root is what lets those
  // resolve into `.next/standalone/node_modules`.
  // (`@toastly/access` specifically does *not* rely on this — Turbopack
  // inlines workspace packages into the server chunks, so it appears nowhere
  // in the bundle. Verified: no `@toastly/access` reference in .next/server.)
  outputFileTracingRoot: path.resolve(__dirname, '../..'),

  experimental: {
    // Already the default in Next 16.3 — pinned so the CI cache step has a
    // config-level contract to point at, and so a future default flip is a
    // deliberate change here rather than a silent build-time regression.
    turbopackFileSystemCacheForBuild: true,
    // Connectivity detection + auto-retry for soft navigations and Server
    // Actions, and what makes `useOffline` (from `next/offline`) return a
    // real value instead of always `false`. See `OfflineScreen`. This is
    // *not* full offline caching — a cold load with no network still fails
    // at the browser level, since there is no service-worker precache of
    // pages/assets. See the PWA guide's "Extending your PWA" section.
    useOffline: true,
  },

  env: {
    API_URL,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // The push-only service worker (see public/sw.js) — never cached,
        // so a deploy that changes it is picked up on the next registration
        // check rather than being served stale indefinitely.
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
  async rewrites() {
    // Proxy browser calls to /api/* through to the NestJS app, so the frontend
    // never needs a cross-origin URL in development. In production Nginx routes
    // /api straight to Nest, so this hop is only exercised by `pnpm dev` — but
    // it stays as a correct fallback. Note rewrites are evaluated at build time
    // and baked into routes-manifest.json, so API_URL is fixed at build, not
    // read from the environment at runtime.
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
