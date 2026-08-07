import type { ClubRole as PrismaClubRole } from '@prisma/client';

/** The wire enum the web frontend uses in `lib/education/members.ts`. It
 * predates the `@toastly/access` `ClubRole` union and stays for backwards
 * compatibility with every antd Select in the club-admin surface. Renames
 * happen at this boundary and nowhere else. */
export const OFFICER_ROLES = [
  'President',
  'VPE',
  'VPM',
  'VPPR',
  'Secretary',
  'Treasurer',
  'SAA',
  'Member',
] as const;

export type OfficerRole = (typeof OFFICER_ROLES)[number];

const OFFICER_TO_CLUB: Record<OfficerRole, PrismaClubRole> = {
  President: 'President',
  VPE: 'VPEducation',
  VPM: 'VPMembership',
  VPPR: 'VPPR',
  Secretary: 'Secretary',
  Treasurer: 'Treasurer',
  SAA: 'SergeantAtArms',
  Member: 'Member',
};

const CLUB_TO_OFFICER: Partial<Record<PrismaClubRole, OfficerRole>> = {
  President: 'President',
  VPEducation: 'VPE',
  VPMembership: 'VPM',
  VPPR: 'VPPR',
  Secretary: 'Secretary',
  Treasurer: 'Treasurer',
  SergeantAtArms: 'SAA',
  Member: 'Member',
};

/** ClubRole values not in `OfficerRole`. `ClubAdmin` is exposed via the
 * `isClubAdmin` boolean, not the roster; `Guest` and `IPP` aren't rendered by
 * the current web today, so they drop out of the wire projection. */
export function toOfficerRoles(roles: PrismaClubRole[]): OfficerRole[] {
  const seen = new Set<OfficerRole>();
  const out: OfficerRole[] = [];
  for (const role of roles) {
    const mapped = CLUB_TO_OFFICER[role];
    if (mapped && !seen.has(mapped)) {
      seen.add(mapped);
      out.push(mapped);
    }
  }
  return out;
}

export function toClubRoles(roles: OfficerRole[]): PrismaClubRole[] {
  return roles.map((r) => OFFICER_TO_CLUB[r]);
}

export function isOfficerRole(value: unknown): value is OfficerRole {
  return typeof value === 'string' && (OFFICER_ROLES as readonly string[]).includes(value);
}

/// Whether a person is new to Toastmasters International or already held
/// membership elsewhere before this club placement. String-identical to the
/// Prisma `MemberType` enum, mirroring the `UserStatus` pattern rather than
/// the `OfficerRole` translation layer above — there's no legacy wire name
/// to preserve here.
export const MEMBER_TYPES = ['new', 'existing'] as const;

export type MemberType = (typeof MEMBER_TYPES)[number];
