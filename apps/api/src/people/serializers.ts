import type {
  ContactLog as ContactLogRow,
  Person,
  Prospect,
  VisitLog as VisitLogRow,
} from '@prisma/client';

import type { InviteWire } from '@/invites';
import type { MemberWire } from '@/memberships';
import type { StorageService } from '@/storage';

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
  organization?: string;
  avatarUrl?: string;
  socials?: Array<{ platform: string; url: string }>;
  bio?: string;
  notes?: string;
  firstVisit: string;
  lastVisit: string;
  visitCount: number;
  invitedBy?: string;
  stage: string;
  /** True when this guest is linked to the global identity pool — their
   * shared details (name, bio, avatar…) live on `Person` and sync across
   * every club that knows the number (IDENTITY_PLAN §3). */
  sharedContact?: boolean;
}

export async function toGuestWire(row: Prospect, storage: StorageService): Promise<GuestWire> {
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
  if (row.personId) wire.sharedContact = true;
  if (row.email) wire.email = row.email;
  if (row.phone) wire.phone = row.phone;
  if (row.whatsapp) wire.whatsapp = row.whatsapp;
  if (row.organization) wire.organization = row.organization;
  if (row.avatarUrl) wire.avatarUrl = await storage.resolveUrl(row.avatarUrl);
  if (row.bio) wire.bio = row.bio;
  if (row.notes) wire.notes = row.notes;
  if (row.invitedBy) wire.invitedBy = row.invitedBy;
  const socials = parseSocials(row.socials);
  if (socials.length > 0) wire.socials = socials;
  return wire;
}

export function toGuestWires(rows: Prospect[], storage: StorageService): Promise<GuestWire[]> {
  return Promise.all(rows.map((row) => toGuestWire(row, storage)));
}

/** The number-first lookup that powers the add-guest/add-member autofill
 * card (IDENTITY_PLAN §7): everything the global pool knows about a phone
 * number, plus this club's own history with it. */
export interface PersonLookupWire {
  status: 'found' | 'not-found';
  claimed: boolean;
  firstName?: string;
  lastName?: string;
  email?: string;
  bio?: string;
  avatarUrl?: string;
  whatsapp?: string;
  organization?: string;
  socials?: Array<{ platform: string; url: string }>;
  /** Active memberships across ALL clubs — names visible per product
   * decision (plan §10). */
  memberOf: Array<{ clubId: string; clubName: string; roles: string[] }>;
  /** The requesting club's own relationship with this number. */
  yourClub: {
    isGuest: boolean;
    guestId?: string;
    isMember: boolean;
    visitCount: number;
    roleCount: number;
    speechCount: number;
    lastVisit?: string;
  };
}

export function emptyPersonLookup(): PersonLookupWire {
  return {
    status: 'not-found',
    claimed: false,
    memberOf: [],
    yourClub: { isGuest: false, isMember: false, visitCount: 0, roleCount: 0, speechCount: 0 },
  };
}

export async function toPersonLookupWire(
  person: Person,
  extras: PersonLookupWire['yourClub'] & { memberOf: PersonLookupWire['memberOf'] },
  storage: StorageService,
): Promise<PersonLookupWire> {
  const wire: PersonLookupWire = {
    status: 'found',
    claimed: person.userId !== null,
    firstName: person.firstName,
    lastName: person.lastName,
    memberOf: extras.memberOf,
    yourClub: {
      isGuest: extras.isGuest,
      isMember: extras.isMember,
      visitCount: extras.visitCount,
      roleCount: extras.roleCount,
      speechCount: extras.speechCount,
    },
  };
  if (extras.guestId) wire.yourClub.guestId = extras.guestId;
  if (extras.lastVisit) wire.yourClub.lastVisit = extras.lastVisit;
  if (person.email) wire.email = person.email;
  if (person.bio) wire.bio = person.bio;
  if (person.whatsapp) wire.whatsapp = person.whatsapp;
  if (person.organization) wire.organization = person.organization;
  if (person.avatarUrl) wire.avatarUrl = await storage.resolveUrl(person.avatarUrl);
  const socials = parseSocials(person.socials);
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
