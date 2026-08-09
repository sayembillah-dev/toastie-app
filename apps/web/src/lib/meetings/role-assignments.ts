/** Who's assigned to each meeting role. `roleKey` matches `RoleDef.key` in
 * `./roles.ts` — kept as a plain string on the wire since the role list is
 * presentation-owned. */

export interface RoleAssignment {
  roleKey: string;
  membershipId: string | null;
}

/** `Select`'s `onChange` hands back `undefined` on clear; the API wants an
 * explicit `null` to distinguish "clear this" from "leave it alone". */
export function toRoleAssignmentMap(rows: RoleAssignment[]): Record<string, string | undefined> {
  const map: Record<string, string | undefined> = {};
  for (const row of rows) {
    if (row.membershipId) map[row.roleKey] = row.membershipId;
  }
  return map;
}
