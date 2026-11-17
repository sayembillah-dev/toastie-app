import type { ClubRole, OrgRole, OrgUnitType } from './roles';
import type { Lineage } from './subject';

export interface SessionUser {
  id: string;
  /** Required contact number — every user has one. Sign-in is moving to
   * email; phone sign-in stays only for accounts with no verified email. */
  phone: string;
  /** The sign-in email. `null` on older phone-only accounts. May be set but
   * not yet verified (for example, typed in by an admin) — see
   * `emailVerified`. */
  email: string | null;
  /** True once the account holder proved they read `email`. Independent of
   * any server switch: clients show the "add / verify your email" prompt,
   * which cannot be dismissed, whenever this is false. */
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  /** Data-URL or absolute image URL, self-service via `PATCH /profile`. */
  avatarUrl: string | null;
  isSuperAdmin: boolean;
  /** True when someone other than the account holder chose the current
   * password (creation, admin-driven reset). Drives a post-login "set your
   * own password" nudge — skippable, not an access gate. */
  mustChangePassword: boolean;
  /** True when the account has no verified email AND the server enforces
   * verification (`EMAIL_VERIFICATION_ENFORCED`). Unlike
   * `mustChangePassword` this IS an access gate: the API answers
   * `403 EMAIL_VERIFICATION_REQUIRED` on every change (any method but GET)
   * except the sign-out, password and `/auth/email/*` routes until the
   * account holder verifies an email. Reads still work, so the app can draw
   * the dashboard behind the email prompt. */
  mustVerifyEmail: boolean;
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
