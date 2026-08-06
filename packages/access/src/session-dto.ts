import type { ClubRole, OrgRole, OrgUnitType } from './roles';
import type { Lineage } from './subject';

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
}

export interface SessionMembership {
  clubId: string;
  clubName: string;
  membershipId: string;
  roles: ClubRole[];
  overrides: Record<string, 'allow' | 'deny'>;
  lineage: Lineage;
}

export interface SessionOrgAssignment {
  unitType: OrgUnitType;
  unitId: string;
  unitName: string;
  role: OrgRole;
  lineage: Lineage;
}

export type ActiveContextKey =
  | `club:${string}`
  | `area:${string}`
  | `division:${string}`
  | `district:${string}`
  | 'global';

export interface SessionResponse {
  user: SessionUser;
  memberships: SessionMembership[];
  orgAssignments: SessionOrgAssignment[];
  defaultContextKey: ActiveContextKey;
}
