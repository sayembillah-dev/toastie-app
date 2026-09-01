import type {
  Assignment,
  ClubRole,
  Lineage,
  PermissionSubject,
  SessionMembership,
  SessionOrgAssignment,
  SessionUser,
} from '@toastly/access';

import type { Member, OfficerRole } from '@/lib/education/members';

/** Wire `OfficerRole` names → `@toastly/access` `ClubRole` names. The
 * wire keeps the terse historical names (VPE, VPM, SAA) while the engine
 * uses the full names — this map bridges the two. */
const ROLE_MAP: Record<OfficerRole, ClubRole> = {
  President: 'President',
  VPE: 'VPEducation',
  VPM: 'VPMembership',
  VPPR: 'VPPR',
  Secretary: 'Secretary',
  Treasurer: 'Treasurer',
  SAA: 'SergeantAtArms',
  Moderator: 'Moderator',
  Member: 'Member',
};

function toClubRoles(member: Pick<Member, 'roles' | 'isClubAdmin'>): ClubRole[] {
  const mapped = member.roles.map((r) => ROLE_MAP[r]);
  // The `isClubAdmin` boolean is a role in the engine's model. Keep it
  // additive — a Club Admin also holds their officer roles.
  return member.isClubAdmin && !mapped.includes('ClubAdmin') ? [...mapped, 'ClubAdmin'] : mapped;
}

/** Builds a `PermissionSubject` from the current session — this is what
 * `useCan()` runs its check against. Every membership becomes a
 * `club`-kind assignment; every org assignment becomes an `org`-kind one;
 * a super admin gets the singleton `global` assignment.
 *
 * The same engine that answers `can()` in a Nest guard answers it here, on
 * the exact same shape — that's what keeps the hidden affordance and the
 * 403'd request from disagreeing. */
export function sessionToSubject(
  user: SessionUser,
  memberships: readonly SessionMembership[],
  orgAssignments: readonly SessionOrgAssignment[],
): PermissionSubject {
  const assignments: Assignment[] = [];
  if (user.isSuperAdmin) {
    assignments.push({ kind: 'global', role: 'SuperAdmin' });
  }
  for (const m of memberships) {
    assignments.push({
      kind: 'club',
      clubId: m.clubId,
      membershipId: m.membershipId,
      roles: m.roles,
      overrides: m.overrides,
      lineage: m.lineage,
    });
  }
  for (const a of orgAssignments) {
    assignments.push({
      kind: 'org',
      unitType: a.unitType,
      unitId: a.unitId,
      role: a.role,
      lineage: a.lineage,
    });
  }
  return { userId: user.id, assignments };
}

/** Builds a subject *previewing* another member's permissions — used by the
 * Club Admin permissions tab, which needs to answer "what would this
 * baseline resolve to?" for someone else. Lineage is provided by the
 * caller (usually taken from the current active-club's session
 * membership, since the edited member lives in the same club). */
export function otherMemberToSubject(
  member: Pick<Member, 'id' | 'clubId' | 'userId' | 'roles' | 'isClubAdmin' | 'overrides'>,
  lineage: Lineage,
): PermissionSubject {
  const assignment: Assignment = {
    kind: 'club',
    clubId: member.clubId,
    membershipId: member.id,
    roles: toClubRoles(member),
    overrides: member.overrides ?? {},
    lineage,
  };
  return { userId: member.userId ?? `member:${member.id}`, assignments: [assignment] };
}
