import type { User } from '@prisma/client';

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
    status: row.status,
    isSuperAdmin: row.isSuperAdmin,
    membershipCount,
    orgAssignmentCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export const USERS_PAGE_SIZE = 25;
