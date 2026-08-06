import type { OrgRole, OrgUnitType } from '@toastly/access';

/** A user's role in the org directory (Area/Division/District Director).
 * Distinct from a `Membership`, which is a user's role inside a club. */
export interface OrgAssignment {
  id: string;
  userId: string;
  role: OrgRole;
  unitType: OrgUnitType;
  /** Exactly one of these is set for a given assignment, matching `unitType`. */
  areaId?: string;
  divisionId?: string;
  districtId?: string;
  termStartsOn?: string;
  termEndsOn?: string;
  createdAt: string;
}

export const SEED_ORG_ASSIGNMENTS: OrgAssignment[] = [];
