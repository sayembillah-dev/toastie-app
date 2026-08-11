import type { Membership } from '@prisma/client';

import type { StorageService } from '@/storage/storage.service';

import { type OfficerRole, toOfficerRoles } from './role-mapping';

/** Include this on every `membership.findX` so the roster can show faces.
 *
 * `Membership` denormalises `firstName`/`lastName`/`email` from `User`, but
 * deliberately not the avatar: a photo changes far more often than a name,
 * and a denormalised copy would need syncing on every profile save. The
 * relation is nullable because a Club Admin can add a roster row by hand
 * before that person ever signs up — those have no account, and so no photo. */
export const MEMBERSHIP_AVATAR_INCLUDE = {
  user: { select: { avatarUrl: true } },
} as const;

/** A `Membership` row loaded with `MEMBERSHIP_AVATAR_INCLUDE`. The relation is
 * optional in the type so the few queries that genuinely don't need it still
 * typecheck — they just yield a member with no photo. */
export type MembershipWithUser = Membership & {
  user?: { avatarUrl: string | null } | null;
};

/** Wire shape for `GET/POST /members` — string-identical to the web
 * `lib/education/members.ts` `Member` interface. The DB stores
 * `Membership.roles` as the fuller `ClubRole` union (`VPEducation`,
 * `SergeantAtArms`, etc.); the mapping happens here so the frontend keeps
 * seeing the shorter `OfficerRole` labels (`VPE`, `SAA`). */
export interface MemberWire {
  id: string;
  clubId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  /** Signed, time-limited URL for the linked account's profile photo. Absent
   * when the roster row has no account yet, or that person never set one —
   * the UI falls back to initials. */
  avatarUrl?: string;
  roles: OfficerRole[];
  isClubAdmin: boolean;
  status: 'active' | 'removed';
  overrides?: Record<string, 'allow' | 'deny'>;
  pathway?: string;
  level?: number;
  startingLevel?: number;
  startedProject?: string;
  pathwayStartedAt?: string;
}

export async function toMemberWire(
  row: MembershipWithUser,
  storage: StorageService,
): Promise<MemberWire> {
  const wire: MemberWire = {
    id: row.id,
    clubId: row.clubId,
    firstName: row.firstName,
    lastName: row.lastName,
    roles: toOfficerRoles(row.roles),
    isClubAdmin: row.isClubAdmin,
    status: row.status,
  };
  if (row.userId) wire.userId = row.userId;
  if (row.email) wire.email = row.email;

  const avatar = await storage.resolveOptional(row.user?.avatarUrl);
  if (avatar) wire.avatarUrl = avatar;

  const overrides = parseOverrides(row.grantOverrides);
  if (Object.keys(overrides).length > 0) wire.overrides = overrides;

  if (row.pathway) wire.pathway = row.pathway;
  if (row.level !== null && row.level !== undefined) wire.level = row.level;
  if (row.startingLevel !== null && row.startingLevel !== undefined) {
    wire.startingLevel = row.startingLevel;
  }
  if (row.startedProject) wire.startedProject = row.startedProject;
  if (row.pathwayStartedAt) wire.pathwayStartedAt = row.pathwayStartedAt.toISOString();

  return wire;
}

/** `MemberWire` plus the club's name — the Super Admin user-detail panel
 * shows memberships across many clubs at once, so each row needs to name
 * its club (a single-club roster view never does, since the club is
 * already the page you're on). */
export interface PlatformUserMembershipWire extends MemberWire {
  clubName: string;
}

export async function toPlatformUserMembershipWire(
  row: MembershipWithUser,
  clubName: string,
  storage: StorageService,
): Promise<PlatformUserMembershipWire> {
  return { ...(await toMemberWire(row, storage)), clubName };
}

export function toMemberWires(
  rows: MembershipWithUser[],
  storage: StorageService,
): Promise<MemberWire[]> {
  return Promise.all(rows.map((row) => toMemberWire(row, storage)));
}

function parseOverrides(raw: unknown): Record<string, 'allow' | 'deny'> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, 'allow' | 'deny'> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === 'allow' || value === 'deny') out[key] = value;
  }
  return out;
}
