import type { ClubRole, OrgRole, OrgUnitType } from './roles';

export interface Lineage {
  clubId?: string;
  areaId?: string;
  divisionId?: string;
  districtId?: string;
}

export type Assignment =
  | {
      kind: 'club';
      clubId: string;
      membershipId: string;
      roles: ClubRole[];
      overrides: Record<string, 'allow' | 'deny'>;
      lineage: Lineage;
    }
  | {
      kind: 'org';
      unitType: OrgUnitType;
      unitId: string;
      role: OrgRole;
      lineage: Lineage;
    }
  | { kind: 'global'; role: 'SuperAdmin' };

export interface PermissionSubject {
  userId: string;
  assignments: Assignment[];
  /** Lineage of the caller's active context, populated by the guard from
   * the `X-Toastly-Context` header. When a Director drills into a club
   * they don't hold membership in, service `can()` calls only carry the
   * target's `clubId` — the engine spreads `areaId`/`divisionId`/
   * `districtId` from here so an org grant at area/division/district
   * scope still matches. */
  contextLineage?: Lineage;
}

export interface Target {
  clubId?: string;
  areaId?: string;
  divisionId?: string;
  districtId?: string;
  ownerMembershipId?: string;
  lineage?: Lineage;
}
