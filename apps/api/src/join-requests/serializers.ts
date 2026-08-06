import type { JoinRequest } from '@prisma/client';

/** Wire shape for `/join-requests` — string-identical to the web
 * `lib/tenancy/join-requests.ts` `JoinRequest` interface. */
export interface JoinRequestWire {
  id: string;
  clubId: string;
  userId: string;
  message?: string;
  status: 'pending' | 'approved' | 'declined' | 'withdrawn';
  decidedByMembershipId?: string;
  decidedAt?: string;
  createdAt: string;
}

export function toJoinRequestWire(row: JoinRequest): JoinRequestWire {
  const wire: JoinRequestWire = {
    id: row.id,
    clubId: row.clubId,
    userId: row.userId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.message) wire.message = row.message;
  if (row.decidedByMembershipId) wire.decidedByMembershipId = row.decidedByMembershipId;
  if (row.decidedAt) wire.decidedAt = row.decidedAt.toISOString();
  return wire;
}
