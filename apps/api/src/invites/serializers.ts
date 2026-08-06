import type { Invite } from '@prisma/client';

import { type OfficerRole, toOfficerRoles } from '@/memberships';

/** Wire shape for `/invites` — string-identical to the web
 * `lib/club-admin/invites.ts` `Invite` interface. `respondedAt` on the wire
 * covers both `acceptedAt` and `revokedAt` because the frontend only shows
 * one "responded on" column. */
export interface InviteWire {
  id: string;
  clubId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: OfficerRole[];
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  /** Membership id of the Club Admin who sent it, resolved by the service
   * from `Invite.invitedByUserId` via the sender's active membership in this
   * club. Preserves the web's "invited by <name>" affordance. */
  invitedBy: string;
  invitedAt: string;
  respondedAt?: string;
}

export function toInviteWire(row: Invite, invitedByMembershipId: string): InviteWire {
  const wire: InviteWire = {
    id: row.id,
    clubId: row.clubId,
    email: row.email,
    roles: toOfficerRoles(row.roles),
    status: row.status,
    invitedBy: invitedByMembershipId,
    invitedAt: row.createdAt.toISOString(),
  };
  if (row.firstName) wire.firstName = row.firstName;
  if (row.lastName) wire.lastName = row.lastName;
  const responded = row.acceptedAt ?? row.revokedAt;
  if (responded) wire.respondedAt = responded.toISOString();
  return wire;
}
