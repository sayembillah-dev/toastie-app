import { Injectable } from '@nestjs/common';
import type {
  ActiveContextKey,
  Assignment,
  Lineage,
  PermissionSubject,
  SessionMembership,
  SessionOrgAssignment,
  SessionResponse,
} from '@toastly/access';

import { PrismaService } from '@/prisma';

/** Loads a `SessionResponse` and a matching `PermissionSubject` for a
 * given user in one pass so `/auth/session` and the guards read from the
 * same source of truth. Anything that queries memberships/assignments in
 * hot code paths goes through here — never re-derive membership shape.
 *
 * Overrides on `Membership.grantOverrides` are JSON of shape
 * `{ "resource:action": "allow" | "deny" }` per §1.3 of the plan. Anything
 * else (unknown keys, wrong value) is silently ignored — the engine
 * defaults to the role grant, which is the safe outcome.
 */
@Injectable()
export class SubjectFactory {
  constructor(private readonly prisma: PrismaService) {}

  async loadSession(userId: string, now: number): Promise<SessionResponse | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isSuperAdmin: true,
        mustChangePassword: true,
        status: true,
      },
    });
    if (!user || user.status !== 'active') return null;

    const [rawMemberships, rawOrgAssignments] = await Promise.all([
      this.prisma.membership.findMany({
        where: { userId, status: 'active' },
        select: {
          id: true,
          clubId: true,
          roles: true,
          isClubAdmin: true,
          grantOverrides: true,
          club: {
            select: { id: true, name: true, areaId: true, divisionId: true, districtId: true },
          },
        },
      }),
      this.prisma.orgAssignment.findMany({
        where: { userId },
        include: {
          area: { select: { id: true, name: true, divisionId: true, districtId: true } },
          division: { select: { id: true, name: true, districtId: true } },
          district: { select: { id: true, name: true } },
        },
      }),
    ]);

    const memberships: SessionMembership[] = rawMemberships.map((m) => {
      const lineage: Lineage = {
        clubId: m.clubId,
        areaId: m.club.areaId ?? undefined,
        divisionId: m.club.divisionId ?? undefined,
        districtId: m.club.districtId ?? undefined,
      };
      // `isClubAdmin` is the display flag the roster UI toggles; the
      // permission engine reads its grants off `roles`, so mirror the
      // boolean into the roles list here. Belt-and-braces against a seed
      // row (or historical mutation) where the two diverge.
      const roles =
        m.isClubAdmin && !m.roles.includes('ClubAdmin')
          ? ([...m.roles, 'ClubAdmin'] as typeof m.roles)
          : m.roles;
      return {
        clubId: m.clubId,
        clubName: m.club.name,
        membershipId: m.id,
        roles,
        overrides: parseOverrides(m.grantOverrides),
        lineage,
      };
    });

    const orgAssignments: SessionOrgAssignment[] = rawOrgAssignments
      .map((a): SessionOrgAssignment | null => {
        if (a.unitType === 'area' && a.area) {
          return {
            unitType: 'area',
            unitId: a.area.id,
            unitName: a.area.name,
            role: a.role,
            lineage: {
              areaId: a.area.id,
              divisionId: a.area.divisionId,
              districtId: a.area.districtId,
            },
          };
        }
        if (a.unitType === 'division' && a.division) {
          return {
            unitType: 'division',
            unitId: a.division.id,
            unitName: a.division.name,
            role: a.role,
            lineage: {
              divisionId: a.division.id,
              districtId: a.division.districtId,
            },
          };
        }
        if (a.unitType === 'district' && a.district) {
          return {
            unitType: 'district',
            unitId: a.district.id,
            unitName: a.district.name,
            role: a.role,
            lineage: { districtId: a.district.id },
          };
        }
        return null;
      })
      .filter((x): x is SessionOrgAssignment => x !== null);

    const defaultContextKey = pickDefaultContext(user.isSuperAdmin, memberships, orgAssignments);

    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        isSuperAdmin: user.isSuperAdmin,
        mustChangePassword: user.mustChangePassword,
      },
      memberships,
      orgAssignments,
      defaultContextKey,
    };
  }

  toSubject(session: SessionResponse): PermissionSubject {
    const assignments: Assignment[] = [];
    if (session.user.isSuperAdmin) {
      assignments.push({ kind: 'global', role: 'SuperAdmin' });
    }
    for (const m of session.memberships) {
      assignments.push({
        kind: 'club',
        clubId: m.clubId,
        membershipId: m.membershipId,
        roles: m.roles,
        overrides: m.overrides,
        lineage: m.lineage,
      });
    }
    for (const oa of session.orgAssignments) {
      assignments.push({
        kind: 'org',
        unitType: oa.unitType,
        unitId: oa.unitId,
        role: oa.role,
        lineage: oa.lineage,
      });
    }
    return { userId: session.user.id, assignments };
  }
}

/** Picks a sensible landing context for `/auth/session` consumers: an owned
 * club first (the common case), then any org assignment, then Super Admin
 * only if the user has literally nothing else. A user with zero of anything
 * returns `global` — the client renders the onboarding screen and never
 * actually acts under that context. */
function pickDefaultContext(
  isSuperAdmin: boolean,
  memberships: SessionMembership[],
  orgAssignments: SessionOrgAssignment[],
): ActiveContextKey {
  if (memberships.length > 0) return `club:${memberships[0].clubId}`;
  if (orgAssignments.length > 0) {
    const oa = orgAssignments[0];
    return `${oa.unitType}:${oa.unitId}` as ActiveContextKey;
  }
  if (isSuperAdmin) return 'global';
  return 'global';
}

function parseOverrides(raw: unknown): Record<string, 'allow' | 'deny'> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, 'allow' | 'deny'> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === 'allow' || value === 'deny') out[key] = value;
  }
  return out;
}
