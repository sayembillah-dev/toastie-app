import type { Invite } from '@/lib/club-admin/invites';
import type { Member } from '@/lib/education/members';

/** The pipeline a guest moves along, from a name on a list to a paid-up member.
 * Ordered — the Kanban board renders the columns in exactly this sequence, and
 * `not-interested` sits last as the parking bay rather than a final step. */
/* `accent` is the column dot; `soft` is the tinted chip behind it — the pair is
 * pre-mixed rather than derived so both stay legible against white. */
export const GUEST_STAGES = [
  { id: 'new', label: 'New', accent: '#64748B', soft: '#F1F5F9' },
  { id: 'contacted', label: 'Contacted', accent: '#B45309', soft: '#FEF3C7' },
  { id: 'interested', label: 'Interested', accent: '#0369A1', soft: '#E0F2FE' },
  { id: 'joined-meetings', label: 'Joined Meeting(s)', accent: '#6D28D9', soft: '#EDE9FE' },
  { id: 'joined-club', label: 'Joined Club', accent: '#047857', soft: '#D1FAE5' },
  { id: 'not-interested', label: 'Not Interested', accent: '#8A8A8A', soft: '#F2F2F2' },
] as const;

export type GuestStage = (typeof GUEST_STAGES)[number]['id'];

export const GUEST_STAGE_IDS: readonly GuestStage[] = GUEST_STAGES.map((stage) => stage.id);

export const DEFAULT_GUEST_STAGE: GuestStage = 'new';

export function isGuestStage(value: unknown): value is GuestStage {
  return GUEST_STAGE_IDS.includes(value as GuestStage);
}

export function getGuestStage(stage: GuestStage): (typeof GUEST_STAGES)[number] {
  return GUEST_STAGES.find((entry) => entry.id === stage) ?? GUEST_STAGES[0];
}

/** Known social platforms. `other` is the catch-all for anything not in the
 * list — the URL still renders, just under a globe icon. */
export const SOCIAL_PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'twitter', label: 'X (Twitter)' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'website', label: 'Website' },
  { id: 'other', label: 'Other' },
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]['id'];

export const SOCIAL_PLATFORM_IDS: readonly SocialPlatform[] = SOCIAL_PLATFORMS.map(
  (platform) => platform.id,
);

export function isSocialPlatform(value: unknown): value is SocialPlatform {
  return SOCIAL_PLATFORM_IDS.includes(value as SocialPlatform);
}

export function getSocialPlatform(id: SocialPlatform): (typeof SOCIAL_PLATFORMS)[number] {
  return (
    SOCIAL_PLATFORMS.find((entry) => entry.id === id) ??
    SOCIAL_PLATFORMS[SOCIAL_PLATFORMS.length - 1]
  );
}

export interface GuestSocial {
  platform: SocialPlatform;
  /** Absolute URL. Stored as-is so the profile can render it straight — broken
   * links are the caller's problem to validate. */
  url: string;
}

export interface Guest {
  id: string;
  /** Tenant boundary — the club this guest is in the pipeline for. */
  clubId: string;
  firstName: string;
  lastName: string;
  email?: string;
  /** E.164-ish phone number (leading `+`, digits only). Feeds tel: and wa.me
   * links straight — the profile strips anything non-numeric before building the
   * WhatsApp URL, but stored numbers should already be clean. */
  phone?: string;
  /** Separate WhatsApp number when it differs from the day-to-day phone. When
   * absent, the profile falls back to `phone` — the "same as phone" checkbox
   * on the edit panel writes `undefined` here. */
  whatsapp?: string;
  /** Data-URL or absolute image URL. Base64 data URLs live comfortably in the
   * local-storage back-end while there is no upload service. */
  avatarUrl?: string;
  /** Freeform list — the edit panel adds/removes blocks; the info card renders
   * whichever platforms are present, with each icon deep-linking out. */
  socials?: GuestSocial[];
  /** Short public-facing paragraph — the guest at a glance. */
  bio?: string;
  /** Private club-facing notes; the space to jot things down that shouldn't sit
   * in the bio. */
  notes?: string;
  /** ISO date (YYYY-MM-DD) of their first visit to the club. */
  firstVisit: string;
  /** ISO date (YYYY-MM-DD) of the most recent visit; equal to firstVisit on day one. */
  lastVisit: string;
  /** Total number of meetings attended so far. */
  visitCount: number;
  /** Free-text name of the member or contact who brought them along. */
  invitedBy?: string;
  /** Where they sit in the follow-up pipeline; the Kanban column they land in. */
  stage: GuestStage;
}

/** Result of `GET /guests/:guestId/match` — what converting this guest
 * would do, shown as a confirmation step before the admin commits. */
export type GuestMatch =
  | { status: 'no-match' }
  | { status: 'already-member'; membership: Member }
  | {
      status: 'existing-user';
      user: { firstName: string; lastName: string; phoneMasked: string };
    };

/** Result of `POST /guests/:guestId/convert-to-member`. `claimed` means the
 * guest's phone matched an existing account and they can log in right away;
 * `unclaimed` means a fresh invite (`invite`) was generated for them. */
export interface ConvertGuestResult {
  membership: Member;
  outcome: 'claimed' | 'unclaimed';
  invite?: Invite;
}

/** Fields the edit panel can write. Excludes the immutable id and derived
 * counters/dates the club records rather than the user typing them. */
export type UpdateGuestInput = Partial<
  Pick<
    Guest,
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'phone'
    | 'whatsapp'
    | 'avatarUrl'
    | 'socials'
    | 'bio'
    | 'notes'
    | 'invitedBy'
    | 'stage'
  >
>;

/** Fields the "Add guest" drawer can write. `firstName`/`lastName` are
 * required — everything else (avatar, socials, bio, notes) can be filled in
 * afterward via the edit panel. No `stage`: every guest starts at `new`. */
export type CreateGuestInput = Pick<Guest, 'firstName' | 'lastName'> &
  Partial<Pick<Guest, 'email' | 'phone' | 'whatsapp' | 'invitedBy'>>;

/** Buckets guests into one list per stage, in board order. Guests carrying a
 * stage we no longer ship fall back to New rather than vanishing. */
export function groupGuestsByStage(guests: readonly Guest[]): Record<GuestStage, Guest[]> {
  const grouped = Object.fromEntries(
    GUEST_STAGE_IDS.map((stage) => [stage, [] as Guest[]]),
  ) as Record<GuestStage, Guest[]>;

  for (const guest of guests) {
    grouped[isGuestStage(guest.stage) ? guest.stage : DEFAULT_GUEST_STAGE].push(guest);
  }
  return grouped;
}

export const SEED_GUESTS: Omit<Guest, 'clubId'>[] = [
  {
    id: 'g-01',
    firstName: 'Elena',
    lastName: 'Vasquez',
    email: 'elena.vasquez@example.com',
    phone: '+447700900101',
    socials: [
      { platform: 'linkedin', url: 'https://linkedin.com/in/elena-vasquez' },
      { platform: 'instagram', url: 'https://instagram.com/elenaspeaks' },
      { platform: 'website', url: 'https://elenavasquez.co' },
    ],
    bio: 'Product manager at a fintech, joined to sharpen her exec-review presentations. Prefers evening sessions and asked about the mentorship track.',
    notes:
      'Follow up before next Thursday — she asked whether the mentorship track has openings this quarter.',
    firstVisit: '2026-07-08',
    lastVisit: '2026-07-22',
    visitCount: 2,
    invitedBy: 'Aisha Patel',
    stage: 'interested',
  },
  {
    id: 'g-02',
    firstName: 'Jamal',
    lastName: 'Osei',
    email: 'jamal.osei@example.com',
    phone: '+447700900102',
    firstVisit: '2026-07-22',
    lastVisit: '2026-07-22',
    visitCount: 1,
    invitedBy: 'Marcus Chen',
    stage: 'new',
  },
  {
    id: 'g-03',
    firstName: 'Mei',
    lastName: 'Tanaka',
    phone: '+447700900103',
    whatsapp: '+447700900233',
    socials: [
      { platform: 'linkedin', url: 'https://linkedin.com/in/mei-tanaka' },
      { platform: 'facebook', url: 'https://facebook.com/mei.tanaka' },
      { platform: 'youtube', url: 'https://youtube.com/@meitanakaspeaks' },
    ],
    bio: 'PhD researcher who wants to get comfortable presenting at conferences. Attended three meetings and is warming up to Table Topics.',
    firstVisit: '2026-06-24',
    lastVisit: '2026-07-22',
    visitCount: 3,
    invitedBy: 'Priya Sharma',
    stage: 'joined-meetings',
  },
  {
    id: 'g-04',
    firstName: 'Lucas',
    lastName: 'Fernandez',
    email: 'lucas.f@example.com',
    firstVisit: '2026-07-15',
    lastVisit: '2026-07-15',
    visitCount: 1,
    stage: 'contacted',
  },
  {
    id: 'g-05',
    firstName: 'Ada',
    lastName: 'Onyekachi',
    email: 'ada.o@example.com',
    phone: '+447700900105',
    firstVisit: '2026-05-13',
    lastVisit: '2026-07-08',
    visitCount: 4,
    invitedBy: 'Grace Okafor',
    stage: 'joined-club',
  },
  {
    id: 'g-06',
    firstName: 'Henrik',
    lastName: 'Sørensen',
    phone: '+447700900106',
    firstVisit: '2026-07-01',
    lastVisit: '2026-07-15',
    visitCount: 2,
    invitedBy: 'Nathan Brooks',
    stage: 'not-interested',
  },
];

export function getGuestInitials(guest: Pick<Guest, 'firstName' | 'lastName'>): string {
  return `${guest.firstName.charAt(0)}${guest.lastName.charAt(0)}`.toUpperCase();
}

const AVATAR_PALETTE = [
  { bg: '#FFE4E6', fg: '#881337' },
  { bg: '#FEF3C7', fg: '#78350F' },
  { bg: '#ECFCCB', fg: '#365314' },
  { bg: '#D1FAE5', fg: '#064E3B' },
  { bg: '#CFFAFE', fg: '#164E63' },
  { bg: '#DBEAFE', fg: '#1E3A8A' },
  { bg: '#E0E7FF', fg: '#312E81' },
  { bg: '#EDE9FE', fg: '#4C1D95' },
  { bg: '#FAE8FF', fg: '#701A75' },
  { bg: '#FCE7F3', fg: '#831843' },
] as const;

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Derived from the id so a guest keeps the same avatar colour wherever they
 * are drawn — card grid, Kanban column or mobile row. */
export function getGuestSwatch(guestId: string): (typeof AVATAR_PALETTE)[number] {
  return AVATAR_PALETTE[hashString(guestId) % AVATAR_PALETTE.length];
}
