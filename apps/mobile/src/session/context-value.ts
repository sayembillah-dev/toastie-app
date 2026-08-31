/**
 * The club or org unit the app is currently acting within.
 *
 * The wire format is `ActiveContextKey` from `@toastly/access` — the same union
 * the API's `ContextGuard` parses out of `X-Toastly-Context` and the same one it
 * hands back as `session.defaultContextKey`. Sharing the type is what keeps this
 * client from inventing an encoding the server does not accept; a context the
 * caller does not actually hold answers a flat 403 `CONTEXT_NOT_HELD`
 * (docs/TDD.md section 7.2), with no hint of what they do hold.
 */

import type { ActiveContextKey, OrgUnitType } from '@toastly/access';

export type ActiveContext =
  | { kind: 'club'; clubId: string; membershipId: string }
  | { kind: 'org'; unitType: OrgUnitType; unitId: string }
  | { kind: 'global' };

/**
 * The key for a context: sent as the `X-Toastly-Context` header, and persisted
 * as the user's last selection. One function for both, because the server's key
 * is already stable across restarts — a membership row can be re-issued, but
 * `club:<clubId>` still names the same club.
 */
export function contextKey(context: ActiveContext | null): ActiveContextKey | null {
  if (!context) return null;
  switch (context.kind) {
    case 'club':
      return `club:${context.clubId}`;
    case 'org':
      return `${context.unitType}:${context.unitId}`;
    case 'global':
      return 'global';
  }
}
