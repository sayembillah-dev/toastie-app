import type { ClubRole, OrgRole, OrgUnitType } from './roles';
import type { Lineage } from './subject';

export interface SessionUser {
  id: string;
  /** Primary auth credential — every user has one. Format is captured
   * verbatim from the register form; normalisation lives at the DB
   * boundary if/when it becomes necessary. */
  phone: string;
  /** Optional contact channel — `null` on accounts that only ever set a
   * phone (the common case). Never used for sign-in. */
  email: string | null;
  firstName: string;
  lastName: string;
  /** Data-URL or absolute image URL, self-service via `PATCH /profile`. */
  avatarUrl: string | null;
  isSuperAdmin: boolean;
  /** True when someone other than the account holder chose the current
   * password (creation, admin-driven reset). Drives a post-login "set your
   * own password" nudge — skippable, not an access gate. */
  mustChangePassword: boolean;
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
  defaultContextKey: ActiveContextKey | null;
}
