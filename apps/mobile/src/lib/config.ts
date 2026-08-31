/**
 * Runtime configuration.
 *
 * The API host is deliberately not baked in. docs/DEPLOYMENT.md keeps it in GitHub
 * secrets and pins the server-side `API_URL` to `http://127.0.0.1:4000` because
 * the web app proxies same-origin — a native client has no proxy to hide behind
 * and must be told the public origin.
 *
 * Set `EXPO_PUBLIC_API_URL` in `.env` (Expo inlines `EXPO_PUBLIC_*` at build
 * time). It must be the origin only; the `/api` prefix is added here, matching
 * the global prefix set in the API's `main.ts`.
 */

/**
 * Read as a bare `process.env.X` member expression, and assigned before use.
 *
 * Expo's Metro transform replaces exactly that shape with a string literal at
 * build time. Anything else is left alone and evaluates against a `process.env`
 * that does not exist in the bundle, so it silently reads `undefined`. The docs
 * name bracket access and destructuring as the broken forms; an optional chain
 * — `process.env.EXPO_PUBLIC_API_URL?.trim()` — breaks the same way and is not
 * listed. Verified by grepping an `expo export` bundle for the value: the bare
 * form appears, the optional-chained one does not.
 */
const rawApiUrl = process.env.EXPO_PUBLIC_API_URL;

/**
 * Accept the value with or without a trailing `/api`, and with or without a
 * trailing slash.
 *
 * Both forms are the natural thing to type — the API is reached at
 * `https://host/api`, so pasting that in is the obvious move, but the client
 * adds the prefix itself. Getting it wrong produced `/api/api/auth/login` and a
 * bare "Cannot POST" from the server, which points at the route rather than at
 * the one line of config that caused it. Normalising here costs a regex and
 * removes the whole class of report.
 *
 * `/api$` is anchored, so a host legitimately ending in `/apiary` is untouched,
 * and a deployment under a sub-path (`https://host/toastie/api`) correctly
 * reduces to `https://host/toastie` before the prefix goes back on.
 */
export function normalizeOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const withoutSlash = trimmed.replace(/\/+$/, '');
  const withoutPrefix = withoutSlash.replace(/\/api$/i, '');
  return withoutPrefix || null;
}

export const API_ORIGIN = normalizeOrigin(rawApiUrl);

/** Every request goes under the API's global `/api` prefix (docs/TDD.md section 5). */
export const API_BASE_URL = API_ORIGIN ? `${API_ORIGIN}/api` : null;

export const IS_API_CONFIGURED = API_BASE_URL !== null;

/**
 * The header that carries which club or org unit a request is acting within.
 * The API's `ContextGuard` validates it against real assignments and answers a
 * flat 403 `CONTEXT_NOT_HELD` on mismatch (docs/TDD.md section 7.2).
 */
export const CONTEXT_HEADER = 'X-Toastly-Context';
