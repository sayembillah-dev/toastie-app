import type { Invite } from '@prisma/client';

import { type OfficerRole, toOfficerRoles } from '@/memberships';

/** Wire shape for `/invites`. `token` rebuilds the shareable
 * `/invite/:token` link — plaintext by design (see `Invite.token` in
 * schema.prisma), so the pending-invites list can re-share the same link
 * without minting a new one. `respondedAt` covers both `acceptedAt` and
 * `revokedAt` because the frontend only shows one "responded on" column. */
export interface InviteWire {
  id: string;
  clubId: string;
  email?: string;
  roles: OfficerRole[];
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  token: string;
  expiresAt: string;
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
    roles: toOfficerRoles(row.roles),
    status: row.status,
    token: row.token,
    expiresAt: row.expiresAt.toISOString(),
    invitedBy: invitedByMembershipId,
    invitedAt: row.createdAt.toISOString(),
  };
  if (row.email) wire.email = row.email;
  const responded = row.acceptedAt ?? row.revokedAt;
  if (responded) wire.respondedAt = responded.toISOString();
  return wire;
}

/** Wire shape for `GET /public/invites/:token` — the unauthenticated
 * landing page's only view into the invite before the visitor signs in. */
export interface InvitePreview {
  state: 'valid' | 'expired' | 'accepted' | 'revoked';
  clubName: string;
  roles: OfficerRole[];
}
