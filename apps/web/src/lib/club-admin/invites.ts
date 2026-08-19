import type { OfficerRole } from '@/lib/education/members';

export const INVITE_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

/** A club invite — a role-scoped, shareable join link (`/invite/:token`),
 * not addressed to anyone in particular. `token` is plaintext on the wire so
 * the pending-invites list can re-display (and re-copy) the same link later. */
export interface Invite {
  id: string;
  /** Tenant boundary — the club this invite is for. */
  clubId: string;
  email?: string;
  inviteeName?: string;
  roles: OfficerRole[];
  status: InviteStatus;
  token: string;
  expiresAt: string;
  /** Member id of the Club Admin (or VP Membership) who created it. */
  invitedBy: string;
  invitedAt: string;
  respondedAt?: string;
}

export type CreateInviteInput = {
  inviteeName: string;
  roles: OfficerRole[];
  /** Targets the invite at one specific unclaimed roster row, so accepting it
   * claims that exact record (and everything already tracked under it) rather
   * than creating a fresh membership. Set by the per-member "Invite" action on
   * the roster; omitted by the generic role-link modal. */
  membershipId?: string;
};

export const SEED_INVITES: Omit<Invite, 'clubId'>[] = [];
