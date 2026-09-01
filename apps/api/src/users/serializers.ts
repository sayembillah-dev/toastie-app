import type { User } from '@prisma/client';

import type { MemberType, OfficerRole } from '@/memberships';
import type { StorageService } from '@/storage';

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
  tiMemberNumber: string | null;
  /** Signed, time-limited URL for the account's profile photo, when set.
   * Read-only — minted per response and expires, so it is never sent back. */
  avatarUrl?: string;
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

export async function toUserWire(
  row: User,
  membershipCount: number,
  orgAssignmentCount: number,
  storage: StorageService,
): Promise<UserWire> {
  const avatarUrl = await storage.resolveOptional(row.avatarUrl);
  return {
    ...(avatarUrl ? { avatarUrl } : {}),
    id: row.id,
    phone: row.phone,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    tiMemberNumber: row.tiMemberNumber,
    status: row.status,
    isSuperAdmin: row.isSuperAdmin,
    membershipCount,
    orgAssignmentCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export const USERS_PAGE_SIZE = 25;
/** Rows-per-page choices the Super Admin can pick on the Users screen. */
export const USERS_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/** Response for `POST /users`. Deliberately does NOT echo the password
 * back — the caller (the SA's own form) already has it in memory, and an
 * API response is the wrong place for a second copy of a plaintext
 * credential to end up in logs or browser devtools history. The club/role
 * fields are included so the client's "copy these credentials" card is
 * built from what the server actually persisted, not what the form
 * assumed would be accepted. */
/** One club's pathway standing, as shown read-only on the profile page. The
 * profile never writes these — pathway/level stay editable only through the
 * Education module. */
export interface ProfileMembershipWire {
  clubId: string;
  clubName: string;
  pathway: string | null;
  level: number | null;
}

/** Wire shape for `GET/PATCH /profile` — the account holder's own view of
 * themselves. Unlike `UserWire` (the Super Admin's cross-tenant list row),
 * this also carries the self-service bio/avatar/socials fields and the
 * read-only pathway summary. */
export interface ProfileWire {
  id: string;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  bio: string | null;
  avatarUrl: string | null;
  socials: Array<{ platform: string; url: string }>;
  createdAt: string;
  memberships: ProfileMembershipWire[];
}

/** Async because `avatarUrl` holds an S3 key that has to be signed for the
 * browser — see the note atop `library/serializers.ts`. */
export async function toProfileWire(
  row: User,
  memberships: ProfileMembershipWire[],
  storage: StorageService,
): Promise<ProfileWire> {
  return {
    id: row.id,
    phone: row.phone,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    bio: row.bio,
    avatarUrl: await storage.resolveOptional(row.avatarUrl),
    socials: parseSocials(row.socials),
    createdAt: row.createdAt.toISOString(),
    memberships,
  };
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

export interface CreateUserResultWire extends UserWire {
  clubId: string | null;
  clubName: string | null;
  roles: OfficerRole[];
  isClubAdmin: boolean;
  memberType: MemberType | null;
  /** Token for the unauthenticated "direct link"/QR handoff page
   * (`GET /public/users/:userId/credentials?t=<token>`) — see
   * `CredentialShare`. The client builds the full URL; this stays a bare
   * token so the API doesn't need to know its own public origin. */
  credentialShare: { token: string };
}

/** `GET /profile/history` (IDENTITY_PLAN §7a) — the account holder's full
 * cross-club footprint, guest-era and member-era rows unioned into one
 * chronological feed. Club-private CRM (stage/notes/logs) never appears. */
export interface MyHistoryEventWire {
  date: string;
  meetingId: string;
  meetingLabel: string;
  clubId: string;
  clubName: string;
  kind: 'visit' | 'role' | 'speech';
  /** Role key or speech title. */
  detail?: string;
  era: 'guest' | 'member';
}

export interface MyHistoryWire {
  events: MyHistoryEventWire[];
  stats: {
    clubsTouched: number;
    meetingsAttended: number;
    roles: number;
    speeches: number;
  };
}
