import type {
  ContactLog as ContactLogRow,
  Prospect,
  VisitLog as VisitLogRow,
} from '@prisma/client';

import type { InviteWire } from '@/invites';
import type { MemberWire } from '@/memberships';

/** Wire shape matches the web `lib/people/guests.ts` `Guest` interface.
 * The DB model is named `Prospect` (to sidestep the `ClubRole.Guest` enum
 * collision), but every wire field and URL keeps saying "guest". */
export interface GuestWire {
  id: string;
  clubId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  avatarUrl?: string;
  socials?: Array<{ platform: string; url: string }>;
  bio?: string;
  notes?: string;
  firstVisit: string;
  lastVisit: string;
  visitCount: number;
  invitedBy?: string;
  stage: string;
}

export function toGuestWire(row: Prospect): GuestWire {
  const wire: GuestWire = {
    id: row.id,
    clubId: row.clubId,
    firstName: row.firstName,
    lastName: row.lastName,
    firstVisit: row.firstVisit ? isoDate(row.firstVisit) : '',
    lastVisit: row.lastVisit ? isoDate(row.lastVisit) : '',
    visitCount: row.visitCount,
    stage: row.stage,
  };
  if (row.email) wire.email = row.email;
  if (row.phone) wire.phone = row.phone;
  if (row.whatsapp) wire.whatsapp = row.whatsapp;
  if (row.avatarUrl) wire.avatarUrl = row.avatarUrl;
  if (row.bio) wire.bio = row.bio;
  if (row.notes) wire.notes = row.notes;
  if (row.invitedBy) wire.invitedBy = row.invitedBy;
  const socials = parseSocials(row.socials);
  if (socials.length > 0) wire.socials = socials;
  return wire;
}

/** Result of `GET /guests/:guestId/match` — a read-only preview of what
 * converting this guest would do, so the frontend can show a confirmation
 * step before the admin commits. */
export type GuestMatchWire =
  | { status: 'no-match' }
  | { status: 'already-member'; membership: MemberWire }
  | { status: 'existing-user'; user: { firstName: string; lastName: string; phoneMasked: string } };

/** Result of `POST /guests/:guestId/convert-to-member`. `outcome` tells the
 * frontend which of the three branches ran: `claimed` (matched an existing
 * account, portal access is immediate), `unclaimed` (no match — `invite`
 * carries the link to hand the guest). `already-member` never reaches here;
 * it's rejected before any write. */
export interface ConvertGuestResultWire {
  membership: MemberWire;
  outcome: 'claimed' | 'unclaimed';
  invite?: InviteWire;
}

export interface ContactLogWire {
  id: string;
  clubId: string;
  guestId: string;
  method: string;
  outcome: string;
  createdAt: string;
  updatedAt?: string;
}

export function toContactLogWire(row: ContactLogRow): ContactLogWire {
  const wire: ContactLogWire = {
    id: row.id,
    clubId: row.clubId,
    guestId: row.prospectId,
    method: row.method,
    outcome: row.outcome,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.updatedAt) wire.updatedAt = row.updatedAt.toISOString();
  return wire;
}

export interface VisitLogWire {
  id: string;
  clubId: string;
  guestId: string;
  meetingId: string;
  role?: string;
  notes?: string;
  origin: 'meeting' | 'manual';
  createdAt: string;
  updatedAt?: string;
}

export function toVisitLogWire(row: VisitLogRow): VisitLogWire {
  const wire: VisitLogWire = {
    id: row.id,
    clubId: row.clubId,
    guestId: row.prospectId,
    // Wire promises `meetingId: string`; empty string when the meeting was
    // deleted (the frontend already falls back to "meeting no longer on file").
    meetingId: row.meetingId ?? '',
    origin: (row.origin as 'meeting' | 'manual') ?? 'manual',
    createdAt: row.createdAt.toISOString(),
  };
  if (row.role) wire.role = row.role;
  if (row.notes) wire.notes = row.notes;
  if (row.updatedAt) wire.updatedAt = row.updatedAt.toISOString();
  return wire;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseSocials(raw: unknown): Array<{ platform: string; url: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ platform: string; url: string }> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { platform, url } = entry as { platform?: unknown; url?: unknown };
    if (typeof platform === 'string' && typeof url === 'string') {
      out.push({ platform, url });
    }
  }
  return out;
}
