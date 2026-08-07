import type { Membership } from '@prisma/client';

import { type OfficerRole, toOfficerRoles } from './role-mapping';

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

export function toMemberWire(row: Membership): MemberWire {
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

export function toPlatformUserMembershipWire(
  row: Membership,
  clubName: string,
): PlatformUserMembershipWire {
  return { ...toMemberWire(row), clubName };
}

function parseOverrides(raw: unknown): Record<string, 'allow' | 'deny'> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, 'allow' | 'deny'> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === 'allow' || value === 'deny') out[key] = value;
  }
  return out;
}
