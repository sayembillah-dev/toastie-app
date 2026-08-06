export const JOIN_REQUEST_STATUSES = ['pending', 'approved', 'declined', 'withdrawn'] as const;
export type JoinRequestStatus = (typeof JOIN_REQUEST_STATUSES)[number];

/** A signed-up user asking to be added to a club's roster. A Club Admin
 * decides; on approve, a `Membership` row is created (or an unclaimed
 * placeholder is claimed). */
export interface JoinRequest {
  id: string;
  clubId: string;
  userId: string;
  message?: string;
  status: JoinRequestStatus;
  decidedByMembershipId?: string;
  decidedAt?: string;
  createdAt: string;
}

export const SEED_JOIN_REQUESTS: JoinRequest[] = [];
