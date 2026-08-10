import type { Assignee } from '@/lib/education/planner';
import type { RoleHolder } from '@/lib/meetings/draft';

/** Who's assigned to each meeting role. `roleKey` matches `RoleDef.key` in
 * `./roles.ts` — kept as a plain string on the wire since the role list is
 * presentation-owned. A role is held by a member OR a guest, never both. */

export interface RoleAssignment {
  roleKey: string;
  membershipId: string | null;
  guestId: string | null;
}

/** Resolves the persisted role rows into the draft's `RoleHolder` shape —
 * a guest assignment needs the roster to pre-resolve a display name, the
 * same way `toDraftSpeakers` does for a guest speaker/evaluator, since
 * Overview and the Agenda sheet only know how to look member ids up. */
export function toRoleHolderMap(
  rows: RoleAssignment[],
  guests: Array<{ id: string; firstName: string; lastName: string }>,
): Record<string, RoleHolder | undefined> {
  const map: Record<string, RoleHolder | undefined> = {};
  for (const row of rows) {
    if (row.membershipId) {
      map[row.roleKey] = { memberId: row.membershipId };
    } else if (row.guestId) {
      const guest = guests.find((g) => g.id === row.guestId);
      map[row.roleKey] = {
        guestId: row.guestId,
        name: guest ? `${guest.firstName} ${guest.lastName}` : 'Unknown guest',
      };
    }
  }
  return map;
}

/** Same idea as `toRoleAssignmentMap`, but resolved into the `Assignee`
 * union `AssigneeSelect` speaks — lets the Roles tab reuse the same picker
 * and label helpers as the planner. A guest assignment needs the roster to
 * resolve a display name, so `guests` is required here. */
export function toAssigneeMap(
  rows: RoleAssignment[],
  guests: Array<{ id: string; firstName: string; lastName: string }>,
): Record<string, Assignee | undefined> {
  const map: Record<string, Assignee | undefined> = {};
  for (const row of rows) {
    if (row.membershipId) {
      map[row.roleKey] = { kind: 'member', memberId: row.membershipId };
    } else if (row.guestId) {
      const guest = guests.find((g) => g.id === row.guestId);
      map[row.roleKey] = {
        kind: 'guest',
        guestId: row.guestId,
        name: guest ? `${guest.firstName} ${guest.lastName}` : 'Unknown guest',
      };
    }
  }
  return map;
}

/** The reverse of `toAssigneeMap`'s per-entry resolution — turns whatever
 * `AssigneeSelect` handed back into the `{membershipId, guestId}` pair every
 * write endpoint (`setMeetingRole`, prepared speakers) takes on the wire. */
export function assigneeToRef(assignee: Assignee | null): {
  membershipId: string | null;
  guestId: string | null;
} {
  if (!assignee) return { membershipId: null, guestId: null };
  if (assignee.kind === 'member') return { membershipId: assignee.memberId, guestId: null };
  return { membershipId: null, guestId: assignee.guestId ?? null };
}
