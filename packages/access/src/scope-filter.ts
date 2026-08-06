import { overrideKey } from './can';
import { CLUB_ROLE_GRANTS, ORG_ROLE_GRANTS } from './grants';
import type { Action, ResourceKey } from './resources';
import type { Assignment, PermissionSubject } from './subject';

export type ScopeFilter =
  | { kind: 'global' }
  | { kind: 'clubs'; clubIds: string[] }
  | {
      kind: 'orgUnits';
      areaIds: string[];
      divisionIds: string[];
      districtIds: string[];
    }
  | { kind: 'none' };

function assignmentGrants(assignment: Assignment, resource: ResourceKey, action: Action): boolean {
  if (assignment.kind === 'global') return true;
  if (assignment.kind === 'club') {
    const key = overrideKey(resource, action);
    const override = assignment.overrides?.[key];
    if (override === 'deny') return false;
    if (override === 'allow') return true;
    return assignment.roles.some((role) =>
      (CLUB_ROLE_GRANTS[role] ?? []).some((g) => g.resource === resource && g.action === action),
    );
  }
  const rg = ORG_ROLE_GRANTS[assignment.role] ?? [];
  return rg.some((g) => g.resource === resource && g.action === action);
}

export function scopeFilter(
  subject: PermissionSubject,
  action: Action,
  resource: ResourceKey,
): ScopeFilter {
  if (subject.assignments.some((a) => a.kind === 'global')) return { kind: 'global' };

  const clubIds = new Set<string>();
  const areaIds = new Set<string>();
  const divisionIds = new Set<string>();
  const districtIds = new Set<string>();

  for (const assignment of subject.assignments) {
    if (!assignmentGrants(assignment, resource, action)) continue;
    if (assignment.kind === 'club') {
      clubIds.add(assignment.clubId);
    } else if (assignment.kind === 'org') {
      if (assignment.unitType === 'area') areaIds.add(assignment.unitId);
      else if (assignment.unitType === 'division') divisionIds.add(assignment.unitId);
      else if (assignment.unitType === 'district') districtIds.add(assignment.unitId);
    }
  }

  const hasOrg = areaIds.size > 0 || divisionIds.size > 0 || districtIds.size > 0;
  if (clubIds.size === 0 && !hasOrg) return { kind: 'none' };
  if (hasOrg && clubIds.size === 0) {
    return {
      kind: 'orgUnits',
      areaIds: [...areaIds],
      divisionIds: [...divisionIds],
      districtIds: [...districtIds],
    };
  }
  return { kind: 'clubs', clubIds: [...clubIds] };
}
