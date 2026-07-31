# Toastly

A pnpm-workspace monorepo running a Next.js frontend and a NestJS backend from a single command.

## Stack

| App           | Package        | Port | Stack                                            |
| ------------- | -------------- | ---- | ------------------------------------------------ |
| `apps/web`    | `@toastly/web` | 3000 | Next.js 16 (App Router), Tailwind CSS 4, Ant Design 6 |
| `apps/api`    | `@toastly/api` | 4000 | NestJS 11, Express                               |

TypeScript is pinned to 5.9.3 across the workspace — the NestJS 11 CLI is built
against it, so this stays off TypeScript 7 for now.

## Getting started

```bash
pnpm install
pnpm dev
```

`pnpm dev` runs both apps together via `concurrently` with prefixed, colour-coded
output. It uses `-k`, so stopping one (Ctrl-C) tears down the other.

- Frontend: http://localhost:3000
- API: http://localhost:4000/api
- Health check: http://localhost:4000/api/health

## How the two apps talk

The browser never calls port 4000 directly. `next.config.ts` rewrites
`/api/:path*` to `${API_URL}/api/:path*`, so frontend code just calls `/api` and
avoids CORS entirely in development. Nest also enables CORS for
`http://localhost:3000` as a fallback for direct calls.

[`src/lib/api.ts`](apps/web/src/lib/api.ts) wraps both sides of that: on the
server it calls Nest directly at `API_URL`, in the browser it uses the relative
`/api` path. The home page fetches its first payload in a Server Component and
hands it to a client component as props, so the data is in the HTML on first
paint and no `useEffect` is needed.

Copy the env examples if you need to change ports:

```bash
cp apps/api/.env.example apps/api/.env.local
cp apps/web/.env.example apps/web/.env.local
```

## Scripts

Run from the repo root:

| Script           | What it does                                          |
| ---------------- | ----------------------------------------------------- |
| `pnpm dev`       | Both apps in watch mode                               |
| `pnpm dev:web`   | Frontend only                                         |
| `pnpm dev:api`   | Backend only                                          |
| `pnpm build`     | Builds the API, then the frontend                     |
| `pnpm start`     | Runs both production builds                           |
| `pnpm lint`      | Lints every package that defines a `lint` script      |
| `pnpm typecheck` | `tsc --noEmit` across the workspace                   |
| `pnpm clean`     | Removes `dist`, `.next`, and all `node_modules`       |

Target one app with `pnpm --filter @toastly/web <script>`.

## Tailwind and Ant Design together

Tailwind v4 puts its reset in `@layer base`; Ant Design injects its styles
unlayered at runtime. Unlayered CSS always beats layered CSS, so antd components
keep their own styling and preflight only affects plain markup — no override
config needed.

Ant Design is wired up in
[antd-provider.tsx](apps/web/src/components/antd-provider.tsx):
`AntdRegistry` collects css-in-js output during SSR so the first paint is already
styled, and `ConfigProvider` holds the design tokens. Tailwind's matching brand
palette lives in the `@theme` block in
[globals.css](apps/web/src/app/globals.css).

## Layout

```
toastly/
├── apps/
│   ├── api/                  # NestJS
│   │   └── src/
│   │       ├── main.ts             # bootstrap, /api prefix, CORS, validation
│   │       ├── app.module.ts
│   │       ├── app.controller.ts
│   │       ├── app.service.ts
│   │       └── health/
│   └── web/                  # Next.js
│       ├── next.config.ts          # /api proxy to the backend
│       └── src/
│           ├── app/                # App Router
│           ├── components/
│           └── lib/api.ts          # server/browser-aware API client
├── packages/                 # shared packages (add as needed)
├── pnpm-workspace.yaml
└── package.json
```

`packages/*` is already in the workspace globs, so a shared `packages/types`
(or similar) can be dropped in and referenced as `"@toastly/types": "workspace:*"`.
