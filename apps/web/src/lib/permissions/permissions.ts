import type { OfficerRole } from '@/lib/education/members';

/** One entry per nav-level surface that has real API routes behind it.
 * `records` and `me` are deliberately excluded — `/records` has no backing
 * routes today and `/me` is always-accessible personal data, so there is
 * nothing real to gate for either. */
export const MODULES = [
  'meetings',
  'education',
  'library',
  'people',
  'inventory',
  'finance',
  'activityLogs',
  'clubAdmin',
] as const;

export type ModuleKey = (typeof MODULES)[number];

export interface ModulePermission {
  read: boolean;
  mutate: boolean;
}

const MODULE_LABELS: Record<ModuleKey, string> = {
  meetings: 'Meetings',
  education: 'Education',
  library: 'Library',
  people: 'People',
  inventory: 'Inventory & checklist',
  finance: 'Finance',
  activityLogs: 'Activity Logs',
  clubAdmin: 'Club Admin',
};

export function getModuleLabel(module: ModuleKey): string {
  return MODULE_LABELS[module];
}

/** Modules each officer role mutates as part of the job. Everything else on
 * the matrix defaults to read-only for that role until a Club Admin grants
 * more. Existing officer seed data keeps working out of the box once
 * enforcement is live, without every module defaulting wide open. */
const ROLE_MODULE_DEFAULTS: Partial<Record<OfficerRole, ModuleKey[]>> = {
  President: ['meetings', 'education', 'people'],
  VPE: ['education'],
  VPM: ['people'],
  VPPR: ['library'],
  Secretary: ['meetings'],
  Treasurer: ['finance'],
  SAA: ['inventory'],
};

/** Every other module defaults to visible to everyone, matching the app's
 * behavior before permissions existed. `clubAdmin` is the exception — the
 * roster-management surface, per-member permission matrix and admin audit
 * trail it exposes aren't something a plain member should see by default,
 * so it starts closed until a Club Admin explicitly grants it. */
const MODULES_HIDDEN_BY_DEFAULT: readonly ModuleKey[] = ['clubAdmin'];

interface PermissionSubject {
  roles: OfficerRole[];
  isClubAdmin?: boolean;
  permissions?: Partial<Record<ModuleKey, ModulePermission>>;
}

/** The single source of truth for "can this member read/mutate this module" —
 * used both server-side (the route chokepoint in `local-db/handlers.ts`) and
 * client-side (`usePermission`) so the two can never drift. Club Admins
 * always get full access; everyone else gets an explicit per-module override
 * if a Club Admin set one, else the role-based default. */
export function getEffectivePermission(
  subject: PermissionSubject,
  module: ModuleKey,
): ModulePermission {
  if (subject.isClubAdmin) return { read: true, mutate: true };

  const override = subject.permissions?.[module];
  if (override) return override;

  const read = !MODULES_HIDDEN_BY_DEFAULT.includes(module);
  const mutate = read && subject.roles.some((role) => ROLE_MODULE_DEFAULTS[role]?.includes(module));
  return { read, mutate };
}
