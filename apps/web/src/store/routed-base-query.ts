import type { BaseQueryFn, FetchArgs } from '@reduxjs/toolkit/query';
import { fetchBaseQuery } from '@reduxjs/toolkit/query';

import {
  clearAuthStorage,
  readAccessToken,
  readRefreshToken,
  readStoredContext,
  writeAccessToken,
  writeRefreshToken,
} from '@/lib/auth/token-storage';

import { sessionUnauthenticated } from './session-slice';

/** RTK Query baseQuery for `toastlyApi`. Attaches the JWT and the active
 * context on every request, and on 401 tries a rotating-refresh dance once
 * before dropping the session. Post-S12 there is no local branch — every
 * domain hits the Nest API. */

const liveFetch = fetchBaseQuery({
  baseUrl: '/api',
  prepareHeaders: (headers) => {
    const token = readAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    // The context header is always set when we have one — the Nest
    // guard ignores it on `@Public()` routes, so `/auth/*` isn't harmed
    // by its presence.
    const ctx = readStoredContext();
    if (ctx) headers.set('X-Toastly-Context', ctx);
    return headers;
  },
});

/** Second baseQuery used for `/public/*` URLs — an authed browser is fine
 * (the Nest guard skips both `Authorization` and context checks for
 * `@Public()` handlers), but a signed-out browser must not attach an
 * expired token that then triggers the 401 refresh dance. Sharing a link
 * has to work with no session at all. */
const publicFetch = fetchBaseQuery({ baseUrl: '/api' });

function isPublicUrl(args: string | FetchArgs): boolean {
  const url = typeof args === 'string' ? args : args.url;
  return url.startsWith('/public/') || url.startsWith('public/');
}

/** Coalesces concurrent refreshes: if three tabs 401 at once we still only
 * spend one refresh token, and the other two await its resolution. */
let refreshInflight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshInflight) return refreshInflight;
  refreshInflight = (async () => {
    const refreshToken = readRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as {
        tokens?: { accessToken?: string; refreshToken?: string };
      };
      const access = data.tokens?.accessToken;
      const next = data.tokens?.refreshToken;
      if (!access || !next) return false;
      writeAccessToken(access);
      writeRefreshToken(next);
      return true;
    } catch {
      return false;
    }
  })();
  try {
    return await refreshInflight;
  } finally {
    refreshInflight = null;
  }
}

export const routedBaseQuery: BaseQueryFn<string | FetchArgs, unknown, unknown> = async (
  args,
  api,
  extraOptions,
) => {
  // Anonymous share pages hit `/public/*` — no `Authorization` header, no
  // refresh dance on 401 (a 401 there is genuinely "wrong or missing
  // token", not a stale session to rotate).
  if (isPublicUrl(args)) {
    return publicFetch(args, api, extraOptions);
  }

  let result = await liveFetch(args, api, extraOptions);
  if (result.error && result.error.status === 401) {
    // /auth/refresh itself returning 401 → don't recurse; just drop.
    const url = typeof args === 'string' ? args : args.url;
    if (url === '/auth/refresh') {
      clearAuthStorage();
      api.dispatch(sessionUnauthenticated());
      return result;
    }
    const refreshed = await tryRefresh();
    if (refreshed) {
      result = await liveFetch(args, api, extraOptions);
    } else {
      clearAuthStorage();
      api.dispatch(sessionUnauthenticated());
    }
  }
  return result;
};
