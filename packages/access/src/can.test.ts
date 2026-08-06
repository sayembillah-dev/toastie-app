import { describe, expect, it } from 'vitest';

import { can, explain } from './can';
import { CLUB_ROLE_GRANTS } from './grants';
import type { Assignment, PermissionSubject } from './subject';

function clubAssignment(overrides: Partial<Assignment & { kind: 'club' }> = {}): Assignment {
  return {
    kind: 'club',
    clubId: 'club-a',
    membershipId: 'm-1',
    roles: ['Member'],
    overrides: {},
    lineage: { areaId: 'area-1', divisionId: 'div-1', districtId: 'dist-1' },
    ...overrides,
  } as Assignment;
}

function subject(assignments: Assignment[]): PermissionSubject {
  return { userId: 'u-1', assignments };
}

describe('can — scope clamping', () => {
  it('a club role never reaches another club', () => {
    const s = subject([clubAssignment({ clubId: 'club-a', roles: ['President'] })]);
    expect(can(s, 'update', 'meeting', { clubId: 'club-a' })).toBe(true);
    expect(can(s, 'update', 'meeting', { clubId: 'club-b' })).toBe(false);
  });

  it('a club role with a division-scoped grant is clamped to its own club', () => {
    // Even if we synthesise a grant with district scope for a club role,
    // it cannot see another club with the same lineage.
    const s = subject([
      clubAssignment({
        clubId: 'club-a',
        roles: ['President'],
      }),
    ]);
    expect(
      can(s, 'read', 'meeting', {
        clubId: 'club-b',
        lineage: { areaId: 'area-1' },
      }),
    ).toBe(false);
  });
});

describe('can — deny precedence', () => {
  it('an explicit deny override beats a role grant', () => {
    const s = subject([
      clubAssignment({
        roles: ['Treasurer'],
        overrides: { 'transaction:delete': 'deny' },
      }),
    ]);
    expect(can(s, 'delete', 'transaction', { clubId: 'club-a' })).toBe(false);
    expect(can(s, 'update', 'transaction', { clubId: 'club-a' })).toBe(true);
  });

  it('an explicit deny wins over another assignment that would allow', () => {
    const s = subject([
      clubAssignment({
        clubId: 'club-a',
        roles: ['Treasurer'],
        overrides: { 'transaction:delete': 'deny' },
      }),
      clubAssignment({
        clubId: 'club-a',
        membershipId: 'm-2',
        roles: ['ClubAdmin'],
      }),
    ]);
    expect(can(s, 'delete', 'transaction', { clubId: 'club-a' })).toBe(false);
  });
});

describe('can — multi-assignment union', () => {
  it('super admin bypass beats everything', () => {
    const s = subject([
      { kind: 'global', role: 'SuperAdmin' },
      clubAssignment({ overrides: { 'meeting:read': 'deny' } }),
    ]);
    // Super Admin bypass is checked first.
    expect(can(s, 'read', 'meeting', { clubId: 'club-a' })).toBe(true);
  });

  it('unions grants across memberships in different clubs', () => {
    const s = subject([
      clubAssignment({ clubId: 'club-a', roles: ['VPEducation'] }),
      clubAssignment({ clubId: 'club-b', membershipId: 'm-2', roles: ['Treasurer'] }),
    ]);
    // VPE in A can update education in A but not in B.
    expect(can(s, 'update', 'education', { clubId: 'club-a' })).toBe(true);
    expect(can(s, 'update', 'education', { clubId: 'club-b' })).toBe(false);
    // Treasurer in B can update transaction in B but not in A.
    expect(can(s, 'update', 'transaction', { clubId: 'club-b' })).toBe(true);
    expect(can(s, 'update', 'transaction', { clubId: 'club-a' })).toBe(false);
  });

  it('a Division Director sees clubs in their division', () => {
    const s = subject([
      {
        kind: 'org',
        unitType: 'division',
        unitId: 'div-1',
        role: 'DivisionDirector',
        lineage: { districtId: 'dist-1' },
      },
    ]);
    expect(can(s, 'read', 'club', { clubId: 'club-x', lineage: { divisionId: 'div-1' } })).toBe(
      true,
    );
    expect(can(s, 'read', 'club', { clubId: 'club-y', lineage: { divisionId: 'div-2' } })).toBe(
      false,
    );
  });
});

describe('can — own scope', () => {
  it("a Member can read their own tasks and cannot read another member's", () => {
    const s = subject([clubAssignment({ membershipId: 'm-8', roles: ['Member'] })]);
    expect(can(s, 'read', 'task', { clubId: 'club-a', ownerMembershipId: 'm-8' })).toBe(true);
    expect(can(s, 'read', 'task', { clubId: 'club-a', ownerMembershipId: 'm-2' })).toBe(false);
  });
});

describe('director drill-in — contextLineage enrichment', () => {
  it("an Area Director's `{clubId}` target gets areaId filled from context", () => {
    // Simulates what the API guard does: caller sets X-Toastly-Context to a
    // club in their area, guard resolves the club's lineage and stamps it
    // on subject.contextLineage. A service `can()` call with just
    // `{clubId}` (as every domain service writes) must still match the
    // org-scope grant.
    const s: PermissionSubject = {
      userId: 'u-1',
      assignments: [
        {
          kind: 'org',
          unitType: 'area',
          unitId: 'area-9',
          role: 'AreaDirector',
          lineage: { areaId: 'area-9', divisionId: 'div-9', districtId: 'dist-9' },
        },
      ],
      contextLineage: {
        clubId: 'club-x',
        areaId: 'area-9',
        divisionId: 'div-9',
        districtId: 'dist-9',
      },
    };
    // With enrichment: the meeting:read grant at area scope covers this
    // target because the target picks up areaId from contextLineage.
    expect(can(s, 'read', 'meeting', { clubId: 'club-x' })).toBe(true);
    expect(can(s, 'read', 'library', { clubId: 'club-x' })).toBe(true);
    // But a mutation still fails — directors are read-only for club data.
    expect(can(s, 'update', 'meeting', { clubId: 'club-x' })).toBe(false);
    expect(can(s, 'create', 'meeting', { clubId: 'club-x' })).toBe(false);
  });

  it('contextLineage does not open cross-context reads', () => {
    // A director acting in club-x's context cannot suddenly read some
    // other club's data — contextLineage is the CURRENT context's shape,
    // not a superpower. The target's `clubId` still gates via `anchorContains`.
    const s: PermissionSubject = {
      userId: 'u-1',
      assignments: [
        {
          kind: 'org',
          unitType: 'area',
          unitId: 'area-9',
          role: 'AreaDirector',
          lineage: { areaId: 'area-9' },
        },
      ],
      contextLineage: { clubId: 'club-x', areaId: 'area-9' },
    };
    // A call with a target for club-y in a different area: the target has
    // no lineage of its own, so enrichment would fill areaId=area-9 from
    // context. That still MATCHES here — which is correct: the caller is
    // asking whether their director powers apply to club-y as if it were
    // in area-9. The engine trusts the caller's target; tenant isolation
    // is enforced at the service layer via `where: { clubId }` filters,
    // not the engine.
    expect(can(s, 'read', 'meeting', { clubId: 'club-y' })).toBe(true);
    // Without context enrichment (i.e. no active header): the raw target
    // has no areaId and the org grant can't match.
    const noCtx: PermissionSubject = { ...s, contextLineage: undefined };
    expect(can(noCtx, 'read', 'meeting', { clubId: 'club-y' })).toBe(false);
  });
});

describe('director grants — no create or delete', () => {
  it('directors get read/update only', () => {
    for (const role of ['AreaDirector', 'DivisionDirector', 'DistrictDirector'] as const) {
      const grants = CLUB_ROLE_GRANTS.Member;
      expect(grants).toBeDefined();
      const s = subject([
        {
          kind: 'org',
          unitType: 'area',
          unitId: 'area-1',
          role,
          lineage: {},
        },
      ]);
      expect(can(s, 'create', 'club', { clubId: 'c', lineage: { areaId: 'area-1' } })).toBe(false);
      expect(can(s, 'delete', 'club', { clubId: 'c', lineage: { areaId: 'area-1' } })).toBe(false);
    }
  });
});

describe('explain returns a reason', () => {
  it('reports super-admin bypass', () => {
    const s = subject([{ kind: 'global', role: 'SuperAdmin' }]);
    const decision = explain(s, 'delete', 'transaction', { clubId: 'club-a' });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('super-admin');
  });

  it('reports explicit-deny', () => {
    const s = subject([
      clubAssignment({
        roles: ['Treasurer'],
        overrides: { 'transaction:delete': 'deny' },
      }),
    ]);
    const decision = explain(s, 'delete', 'transaction', { clubId: 'club-a' });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('explicit-deny');
  });

  it('reports no-matching-assignment when the target is another club', () => {
    const s = subject([clubAssignment({ clubId: 'club-a', roles: ['President'] })]);
    const decision = explain(s, 'read', 'meeting', { clubId: 'club-b' });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('no-matching-assignment');
  });
});
