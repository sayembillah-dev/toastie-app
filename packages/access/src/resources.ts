export const RESOURCE_KEYS = [
  /** Platform-level User account. Only reachable via the Super Admin
   * bypass — no club/org role grants `user:*`, so a plain Member's or
   * Director's `can(update, user)` decision returns false by default. */
  'user',
  'club',
  'member',
  'memberRole',
  'memberPermission',
  'education',
  'meeting',
  'meetingRole',
  'checklist',
  'tableTopic',
  'attendance',
  'guest',
  'guestLog',
  'library',
  'inventory',
  'transaction',
  'budget',
  'dues',
  'evaluation',
  'speechRequest',
  'task',
  'activityLog',
  'invite',
  'joinRequest',
  'orgUnit',
  /** Area/Division/District Director assignment (the `OrgAssignment` row,
   * distinct from `orgUnit` which is the Area/Division/District entity
   * itself). Only reachable via the Super Admin bypass — no club/org role
   * grants `orgAssignment:*`, matching `user` above. */
  'orgAssignment',
  'report',
] as const;

export type ResourceKey = (typeof RESOURCE_KEYS)[number];

export const ACTIONS = ['create', 'read', 'update', 'delete'] as const;
export type Action = (typeof ACTIONS)[number];

export const SCOPES = ['own', 'club', 'area', 'division', 'district', 'global'] as const;
export type Scope = (typeof SCOPES)[number];

export function isResourceKey(value: string): value is ResourceKey {
  return (RESOURCE_KEYS as readonly string[]).includes(value);
}

export function isAction(value: string): value is Action {
  return (ACTIONS as readonly string[]).includes(value);
}
