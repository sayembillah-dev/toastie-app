export const RESOURCE_KEYS = [
  'club',
  'member',
  'memberRole',
  'memberPermission',
  'education',
  'meeting',
  'meetingRole',
  'checklist',
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
