import type { BaseQueryFn, FetchArgs } from '@reduxjs/toolkit/query';
import { fetchBaseQuery } from '@reduxjs/toolkit/query';

import { refreshSession } from '@/lib/auth/refresh';
import { clearAuthStorage, readAccessToken, readStoredContext } from '@/lib/auth/token-storage';

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
    const outcome = await refreshSession();
    if (outcome.kind === 'refreshed') {
      result = await liveFetch(args, api, extraOptions);
    } else if (outcome.kind === 'rejected') {
      clearAuthStorage();
      api.dispatch(sessionUnauthenticated());
    }
    // `unavailable`: leave the session alone and let this request fail like
    // any other network error — a blip or a deploy is not a sign-out.
  }
  return result;
};
