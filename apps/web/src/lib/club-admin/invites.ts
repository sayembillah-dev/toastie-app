import type { OfficerRole } from '@/lib/education/members';

export const INVITE_STATUSES = ['pending', 'accepted', 'revoked'] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

/** A club invitation. There is no email infrastructure in this app and no
 * sign-up flow for an invitee to accept from — this is a trackable pending
 * record a Club Admin manages by hand: revoke it, or once the person
 * actually joins, convert it into a real `Member` via `convertInviteToMember`. */
export interface Invite {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: OfficerRole[];
  status: InviteStatus;
  /** Member id of the Club Admin who sent it. */
  invitedBy: string;
  invitedAt: string;
  respondedAt?: string;
}

export type CreateInviteInput = Pick<Invite, 'email' | 'firstName' | 'lastName' | 'roles'>;

export const SEED_INVITES: Invite[] = [];
