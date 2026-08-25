import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

/** Live Ah Counter / Timer / Grammarian capture state — validation shared by
 * the authenticated `/meetings/:id/role-state/:kind` routes and the
 * share-token `/public/meetings/:id/role-state/:kind` twins. The `state` blob
 * itself is opaque, client-owned JSON (see the web's
 * `lib/meetings/role-state.ts`); the server stores and serves it verbatim. */

/** String-identical to the web `RoleKind` union in `lib/meetings/role-state.ts`. */
export const ROLE_STATE_KINDS = ['ah-counter', 'timer', 'grammarian'] as const;

/** Cap on the serialized blob — far more than a meeting's worth of counts
 * and timings, small enough that a leaked share token can't fill the table. */
export const ROLE_STATE_MAX_BYTES = 64 * 1024;

export function assertRoleStateKind(kind: string): void {
  if (!(ROLE_STATE_KINDS as readonly string[]).includes(kind)) {
    throw new BadRequestException({
      code: 'UNKNOWN_ROLE_STATE_KIND',
      message: `Role state kind must be one of: ${ROLE_STATE_KINDS.join(', ')}`,
    });
  }
}

export function assertRoleStateSize(state: unknown): void {
  if (JSON.stringify(state ?? null).length > ROLE_STATE_MAX_BYTES) {
    throw new PayloadTooLargeException({
      code: 'ROLE_STATE_TOO_LARGE',
      message: `Role state must serialize to at most ${ROLE_STATE_MAX_BYTES} bytes`,
    });
  }
}
