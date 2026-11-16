import type { AuthResponse } from '@/store/api';
import type { AppDispatch } from '@/store/index';
import { defaultRouteForContext, isContextKeyValid, sessionLoaded } from '@/store/session-slice';

import { safeNextPath } from './next-path';
import { writeAccessToken, writeRefreshToken, writeStoredContext } from './token-storage';

/** The shared tail of every response that signs someone in — login, sign-up
 * and WhatsApp recovery all return `{ tokens, session }`. Stores the token
 * pair, picks the context, hydrates the session slice, and returns where to
 * go next.
 *
 * `next` (e.g. `/invite/:token/accept`) wins over the caller's own context
 * default. A temporary (admin-set) password lands on the "set your own"
 * prompt first, carrying the real destination through. The verify-email
 * gate needs no routing here: `AppFrame` shows it on whatever page this
 * lands on while `mustVerifyEmail` is set. */
export function completeSignIn(
  dispatch: AppDispatch,
  res: AuthResponse,
  nextRaw: string | null,
): string {
  writeAccessToken(res.tokens.accessToken);
  writeRefreshToken(res.tokens.refreshToken);

  const contextKey = isContextKeyValid(res.session.defaultContextKey, res.session)
    ? res.session.defaultContextKey
    : null;
  if (contextKey) writeStoredContext(contextKey);

  dispatch(sessionLoaded({ payload: res.session, contextKey }));

  const next = safeNextPath(nextRaw);
  const destination = next ?? (contextKey ? defaultRouteForContext(contextKey) : '/');
  return res.session.user.mustChangePassword
    ? `/change-password?next=${encodeURIComponent(destination)}`
    : destination;
}
