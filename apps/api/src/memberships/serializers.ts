import type { Membership } from '@prisma/client';

import type { StorageService } from '@/storage/storage.service';

import { type OfficerRole, toOfficerRoles } from './role-mapping';

/** Include this on every `membership.findX` so the roster can show faces and
 * bios.
 *
 * `Membership` denormalises `firstName`/`lastName`/`email` from `User`, but
 * deliberately not the avatar or the bio: both change far more often than a
 * name, and a denormalised copy would need syncing on every profile save. The
 * `user` relation is nullable because a Club Admin can add a roster row by
 * hand before that person ever signs up — those have no account, and so no
 * photo. The `person` link is the shared identity (IDENTITY_PLAN §5): it can
 * carry a bio even for an unclaimed row, from the person's guest era or
 * another club. */
export const MEMBERSHIP_AVATAR_INCLUDE = {
  user: { select: { avatarUrl: true, bio: true } },
  person: { select: { bio: true } },
} as const;

/** A `Membership` row loaded with `MEMBERSHIP_AVATAR_INCLUDE`. The relations
 * are optional in the type so the few queries that genuinely don't need them
 * still typecheck — they just yield a member with no photo and no bio. */
export type MembershipWithUser = Membership & {
  user?: { avatarUrl: string | null; bio: string | null } | null;
  person?: { bio: string | null } | null;
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
  /** Normalised phone of the person this row represents — the claim key an
   * officer sets so a later sign-up auto-links the row and its history.
   * Absent when the roster row was added by name alone. */
  phone?: string;
  /** Signed, time-limited URL for the linked account's profile photo. Absent
   * when the roster row has no account yet, or that person never set one —
   * the UI falls back to initials. */
  avatarUrl?: string;
  /** Short public-facing paragraph, shown on the agenda's person popovers.
   * Read from the shared `Person` identity first (it syncs across clubs),
   * falling back to the account's own profile bio. */
  bio?: string;
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
  if (row.phone) wire.phone = row.phone;

  const avatar = await storage.resolveOptional(row.user?.avatarUrl);
  if (avatar) wire.avatarUrl = avatar;

  const bio = [row.person?.bio, row.user?.bio].find((v) => v?.trim());
  if (bio) wire.bio = bio;

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
