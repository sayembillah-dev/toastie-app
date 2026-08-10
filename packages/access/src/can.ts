import { CLUB_ROLE_GRANTS, type Grant, ORG_ROLE_GRANTS } from './grants';
import type { Action, ResourceKey, Scope } from './resources';
import type { Assignment, Lineage, PermissionSubject, Target } from './subject';

function enrichTarget(
  target: Target | undefined,
  lineage: Lineage | undefined,
): Target | undefined {
  if (!target || !lineage) return target;
  return {
    ...target,
    areaId: target.areaId ?? lineage.areaId,
    divisionId: target.divisionId ?? lineage.divisionId,
    districtId: target.districtId ?? lineage.districtId,
  };
}

export function overrideKey(resource: ResourceKey, action: Action): string {
  return `${resource}:${action}`;
}

/** Does the assignment's anchor cover the target?
 * A `club` assignment anchors on a specific club id; an `org` assignment on
 * a specific area/division/district id (matched directly or via lineage);
 * a `global` assignment covers everything. */
function anchorContains(assignment: Assignment, target: Target | undefined): boolean {
  if (assignment.kind === 'global') return true;
  const lineage = target?.lineage;
  if (assignment.kind === 'club') {
    if (!target?.clubId) return false;
    return target.clubId === assignment.clubId;
  }
  const unitId = assignment.unitId;
  switch (assignment.unitType) {
    case 'area':
      return target?.areaId === unitId || lineage?.areaId === unitId;
    case 'division':
      return target?.divisionId === unitId || lineage?.divisionId === unitId;
    case 'district':
      return target?.districtId === unitId || lineage?.districtId === unitId;
  }
}

/** A grant with a wider scope than its assignment's anchor is clamped down.
 * A club role can never produce cross-club reach regardless of what the
 * grants table says — the anchor is the ceiling. */
function scopeAtMost(grant: Grant, assignment: Assignment): Scope {
  if (assignment.kind === 'global') return grant.scope;
  if (assignment.kind === 'club') {
    // The only meaningful narrowing at a club anchor is `own`; anything
    // wider than `club` clamps to `club`.
    if (grant.scope === 'own') return 'own';
    return 'club';
  }
  // Org anchor: never widen past the anchor's own unit type.
  const anchorScope: Scope = assignment.unitType;
  const order: Scope[] = ['own', 'club', 'area', 'division', 'district', 'global'];
  const gi = order.indexOf(grant.scope);
  const ai = order.indexOf(anchorScope);
  return gi < ai ? grant.scope : anchorScope;
}

function grantsFor(assignment: Assignment): Grant[] {
  if (assignment.kind === 'global') return [];
  if (assignment.kind === 'club') {
    const out: Grant[] = [];
    for (const role of assignment.roles) {
      const rg = CLUB_ROLE_GRANTS[role];
      if (rg) out.push(...rg);
    }
    return out;
  }
  return ORG_ROLE_GRANTS[assignment.role] ?? [];
}

function matches(
  grant: Grant,
  action: Action,
  resource: ResourceKey,
  assignment: Assignment,
  target: Target | undefined,
): boolean {
  if (grant.resource !== resource || grant.action !== action) return false;
  const effectiveScope = scopeAtMost(grant, assignment);
  if (effectiveScope === 'own') {
    if (assignment.kind !== 'club') return false;
    if (!target?.ownerMembershipId) return false;
    return target.ownerMembershipId === assignment.membershipId;
  }
  return true;
}

interface Decision {
  allowed: boolean;
  reason: string;
  via?: Assignment;
}

function decide(
  subject: PermissionSubject,
  action: Action,
  resource: ResourceKey,
  target?: Target,
): Decision {
  // 1. Super Admin bypass.
  const superAdmin = subject.assignments.find((a) => a.kind === 'global');
  if (superAdmin) {
    return { allowed: true, reason: 'super-admin', via: superAdmin };
  }

  // Enrich the target with the caller's context lineage — a Director sets
  // `X-Toastly-Context: club:X`, but their assignments' anchors are the
  // parent area/division/district. Filling `areaId`/etc. from the context
  // makes `anchorContains` recognise them without every service call site
  // plumbing lineage explicitly. Only fills missing keys, so a target
  // that carried its own lineage (e.g. from a directly-loaded row in a
  // different scope) wins.
  const enrichedTarget = enrichTarget(target, subject.contextLineage);

  // 2. Collect matching assignments.
  const matching = subject.assignments.filter((a) => anchorContains(a, enrichedTarget));
  if (matching.length === 0) {
    return { allowed: false, reason: 'no-matching-assignment' };
  }

  let allow: Assignment | undefined;
  let deny: Assignment | undefined;

  for (const assignment of matching) {
    // 3. Expand grants.
    const grants = grantsFor(assignment);
    const baseAllowed = grants.some((g) =>
      matches(g, action, resource, assignment, enrichedTarget),
    );

    // 4. Layer overrides (club assignments only).
    let effectiveAllowed = baseAllowed;
    if (assignment.kind === 'club') {
      const key = overrideKey(resource, action);
      const override = assignment.overrides?.[key];
      if (override === 'allow') effectiveAllowed = true;
      if (override === 'deny') {
        // Deny override wins for this assignment.
        deny = assignment;
        continue;
      }
    }

    if (effectiveAllowed && !allow) allow = assignment;
  }

  // 5. Explicit deny wins.
  if (deny) {
    return { allowed: false, reason: 'explicit-deny', via: deny };
  }

  if (allow) {
    return { allowed: true, reason: 'role-grant', via: allow };
  }

  // 6. Default deny.
  return { allowed: false, reason: 'no-grant' };
}

export function can(
  subject: PermissionSubject,
  action: Action,
  resource: ResourceKey,
  target?: Target,
): boolean {
  return decide(subject, action, resource, target).allowed;
}

export function explain(
  subject: PermissionSubject,
  action: Action,
  resource: ResourceKey,
  target?: Target,
): Decision {
  return decide(subject, action, resource, target);
}
