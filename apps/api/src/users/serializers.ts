import type { User } from '@prisma/client';

import type { MemberType, OfficerRole } from '@/memberships';

/** Wire shape returned by `/users` — the Super Admin's cross-tenant view.
 * Never returned by any other endpoint (which would leak cross-club data).
 * `passwordHash` is deliberately omitted; `phone` is exposed because the
 * SA needs it to identify the account. */
export interface UserWire {
  id: string;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  tiMemberNumber: string | null;
  status: 'active' | 'suspended';
  isSuperAdmin: boolean;
  membershipCount: number;
  orgAssignmentCount: number;
  createdAt: string;
}

export interface UsersPageWire {
  items: UserWire[];
  total: number;
  hasMore: boolean;
}

export function toUserWire(
  row: User,
  membershipCount: number,
  orgAssignmentCount: number,
): UserWire {
  return {
    id: row.id,
    phone: row.phone,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    tiMemberNumber: row.tiMemberNumber,
    status: row.status,
    isSuperAdmin: row.isSuperAdmin,
    membershipCount,
    orgAssignmentCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export const USERS_PAGE_SIZE = 25;
/** Rows-per-page choices the Super Admin can pick on the Users screen. */
export const USERS_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/** Response for `POST /users`. Deliberately does NOT echo the password
 * back — the caller (the SA's own form) already has it in memory, and an
 * API response is the wrong place for a second copy of a plaintext
 * credential to end up in logs or browser devtools history. The club/role
 * fields are included so the client's "copy these credentials" card is
 * built from what the server actually persisted, not what the form
 * assumed would be accepted. */
export interface CreateUserResultWire extends UserWire {
  clubId: string | null;
  clubName: string | null;
  roles: OfficerRole[];
  isClubAdmin: boolean;
  memberType: MemberType | null;
  /** Token for the unauthenticated "direct link"/QR handoff page
   * (`GET /public/users/:userId/credentials?t=<token>`) — see
   * `CredentialShare`. The client builds the full URL; this stays a bare
   * token so the API doesn't need to know its own public origin. */
  credentialShare: { token: string };
}
