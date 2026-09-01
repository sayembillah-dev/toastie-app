import { PRIMARY_CLUB_ID } from '@/lib/tenancy/clubs';

export const OFFICER_ROLES = [
  'President',
  'VPE',
  'VPM',
  'VPPR',
  'Secretary',
  'Treasurer',
  'SAA',
  'Moderator',
  'Member',
] as const;

export type OfficerRole = (typeof OFFICER_ROLES)[number];

export const PATHWAYS = [
  'Dynamic Leadership',
  'Effective Coaching',
  'Engaging Humor',
  'Innovative Planning',
  'Leadership Development',
  'Motivational Strategies',
  'Persuasive Influence',
  'Presentation Mastery',
  'Strategic Relationships',
  'Team Collaboration',
  'Visionary Communication',
] as const;

export type Pathway = (typeof PATHWAYS)[number];

export type Level = 1 | 2 | 3 | 4 | 5;

export interface Member {
  id: string;
  /** The club this membership belongs to. Every operational row in the app
   * is scoped by this — a Member in club A cannot appear in club B's roster.
   * On the DB side this is `Membership.clubId`. */
  clubId: string;
  /** The user account this membership is claimed by, once the person signs
   * up. `undefined` for placeholder roster rows a Club Admin added by hand
   * before that person had an account. */
  userId?: string;
  /** Normalised 11-digit phone — the claim key. When someone signs up with
   * this number, this roster row (and every agenda/attendance/history row
   * keyed to it) links to their account automatically. Absent for name-only
   * roster rows. */
  phone?: string;
  firstName: string;
  lastName: string;
  /** A member can hold more than one officer role at once (e.g. Secretary and
   * SAA in a small club). Empty means a plain member — `getPrimaryRole`
   * treats that the same as `['Member']`. */
  roles: OfficerRole[];
  /** Grants full read/mutate access to every module regardless of role or
   * per-module overrides. Independent of officer role — a plain Member can be
   * a Club Admin, and a President need not be one. */
  isClubAdmin: boolean;
  /** `removed` is a soft delete — the record and its history stay put, the
   * member just drops out of the active roster. */
  status: 'active' | 'removed';
  /** Signed, time-limited URL for this person's profile photo, when the
   * roster row is claimed by an account that has one. Absent for unclaimed
   * rows and for members who never uploaded one — render `getInitials`
   * instead. `PersonAvatar` handles both cases.
   *
   * Read-only: it is minted per response and expires, so it is never sent
   * back on a member update. The photo is owned by the profile screen. */
  avatarUrl?: string;
  /** Short public-facing paragraph — sourced from the member's shared
   * identity (`Person`), falling back to their account profile. Shown on the
   * agenda's person popovers. Absent when the person has written none. */
  bio?: string;
  /** Per-`resource:action` overrides on top of the role-based grants in
   * `@toastly/access`. Keys look like `"transaction:update"` and the value is
   * either `'allow'` or `'deny'`; only entries a Club Admin has explicitly
   * touched appear here. Deny wins over the role default *and* over an
   * allow-override on another assignment, matching the engine's own layering. */
  overrides?: Record<string, 'allow' | 'deny'>;
  /** Undefined until the member starts a pathway from their profile. */
  pathway?: Pathway;
  /** Current level. Undefined while `pathway` is undefined. */
  level?: Level;
  /** Level the member's journey begins at on this platform. Members migrated in
   * from an older tracker can start at level 3 or higher, and the progress view
   * anchors to this value rather than pretending they began at level 1. */
  startingLevel?: Level;
  /** Project chosen when the pathway was started. */
  startedProject?: string;
  /** ISO date the pathway was started on this platform. */
  pathwayStartedAt?: string;
}

/** Fields the Club Admin "Add member" form writes. `name` is the single
 * "Full name" input — split server-side, wins over the legacy first/last
 * pair. `roles` defaults to `['Member']` server-side when omitted. */
export type CreateMemberInput = Pick<Member, 'phone'> & {
  name?: string;
  firstName?: string;
  lastName?: string;
  roles?: OfficerRole[];
};

/** Fields the Club Admin "Edit member" form can write. Status, admin flag and
 * permissions each have their own dedicated endpoint — this one is plain
 * profile/role editing. */
export type UpdateMemberInput = Partial<
  Pick<Member, 'firstName' | 'lastName' | 'roles' | 'phone'>
> & {
  /** Single "Full name" input — the API splits it on the first space. */
  name?: string;
};

/** One row of a bulk-add submission that didn't make it onto the roster.
 * `index` points at the row's position in the submitted array so the bulk-add
 * table can line the failure back up with the right row. */
export interface BulkCreateMemberFailure {
  index: number;
  firstName: string;
  lastName: string;
  phone?: string;
  code: string;
  message: string;
}

/** Result of `POST /members/bulk` — best-effort per row: conflicts (phone
 * already on the roster, duplicate phone inside the batch) are reported in
 * `failed`, the rest are created. */
export interface BulkCreateMembersResult {
  created: Member[];
  failed: BulkCreateMemberFailure[];
}

export const SEED_MEMBERS: Member[] = [
  {
    id: 'm-01',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Aisha',
    lastName: 'Patel',
    roles: ['President'],
    isClubAdmin: true,
    status: 'active',
    level: 4,
    pathway: 'Presentation Mastery',
  },
  {
    id: 'm-02',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Marcus',
    lastName: 'Chen',
    roles: ['VPE'],
    isClubAdmin: false,
    status: 'active',
    level: 5,
    pathway: 'Effective Coaching',
  },
  {
    id: 'm-03',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Priya',
    lastName: 'Sharma',
    roles: ['VPM'],
    isClubAdmin: false,
    status: 'active',
    level: 3,
    pathway: 'Dynamic Leadership',
  },
  {
    id: 'm-04',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Daniel',
    lastName: 'Ortiz',
    roles: ['VPPR'],
    isClubAdmin: false,
    status: 'active',
    level: 2,
    pathway: 'Innovative Planning',
  },
  {
    id: 'm-05',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Sophia',
    lastName: 'Nakamura',
    roles: ['Secretary'],
    isClubAdmin: false,
    status: 'active',
    level: 3,
    pathway: 'Team Collaboration',
  },
  {
    id: 'm-06',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Nathan',
    lastName: 'Brooks',
    roles: ['Treasurer'],
    isClubAdmin: false,
    status: 'active',
    level: 4,
    pathway: 'Strategic Relationships',
  },
  {
    id: 'm-07',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Yara',
    lastName: 'Ibrahim',
    roles: ['SAA'],
    isClubAdmin: false,
    status: 'active',
    level: 2,
    pathway: 'Motivational Strategies',
  },
  {
    id: 'm-08',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Liam',
    lastName: 'Reeves',
    roles: ['Member'],
    isClubAdmin: false,
    status: 'active',
    level: 1,
    pathway: 'Engaging Humor',
  },
  {
    id: 'm-09',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Grace',
    lastName: 'Okafor',
    roles: ['Member'],
    isClubAdmin: false,
    status: 'active',
    level: 5,
    pathway: 'Visionary Communication',
  },
  {
    id: 'm-10',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Rafael',
    lastName: 'Mendoza',
    roles: ['Member'],
    isClubAdmin: false,
    status: 'active',
    level: 2,
    pathway: 'Persuasive Influence',
  },
  {
    id: 'm-11',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Hannah',
    lastName: 'Klein',
    roles: ['Member'],
    isClubAdmin: false,
    status: 'active',
    level: 3,
    pathway: 'Leadership Development',
  },
  {
    id: 'm-12',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Kenji',
    lastName: 'Watanabe',
    roles: ['Member'],
    isClubAdmin: false,
    status: 'active',
    level: 1,
    pathway: 'Presentation Mastery',
  },
  {
    id: 'm-13',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Zara',
    lastName: 'Ahmed',
    roles: ['Member'],
    isClubAdmin: false,
    status: 'active',
    level: 4,
    pathway: 'Dynamic Leadership',
  },
  {
    id: 'm-14',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Ethan',
    lastName: 'Kowalski',
    roles: ['Member'],
    isClubAdmin: false,
    status: 'active',
    level: 2,
    pathway: 'Effective Coaching',
  },
  {
    id: 'm-15',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Riley',
    lastName: 'Novak',
    roles: ['Member'],
    isClubAdmin: false,
    status: 'active',
  },
  {
    id: 'm-16',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Amelia',
    lastName: 'Fischer',
    roles: ['Member'],
    isClubAdmin: false,
    status: 'active',
  },
  {
    id: 'm-17',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Tomas',
    lastName: 'Rivera',
    roles: ['Member'],
    isClubAdmin: false,
    status: 'active',
  },
  {
    id: 'm-18',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Nadia',
    lastName: 'Haddad',
    roles: ['Member'],
    isClubAdmin: false,
    status: 'active',
  },
  {
    id: 'm-19',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Oliver',
    lastName: 'Bennett',
    roles: ['Member'],
    isClubAdmin: false,
    status: 'active',
  },
  {
    id: 'm-20',
    clubId: PRIMARY_CLUB_ID,
    firstName: 'Chloe',
    lastName: 'Dubois',
    roles: ['Member'],
    isClubAdmin: false,
    status: 'active',
  },
];

export function getInitials(member: Pick<Member, 'firstName' | 'lastName'>): string {
  return `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase();
}

/** The role compact contexts (search, table rows) show when there's only room
 * for one. A member with no roles reads the same as a plain Member. */
export function getPrimaryRole(member: Pick<Member, 'roles'>): OfficerRole {
  return member.roles[0] ?? 'Member';
}

/** Every role a member holds, for contexts with room to show all of them. */
export function formatRoles(member: Pick<Member, 'roles'>): string {
  return member.roles.length > 0 ? member.roles.join(', ') : 'Member';
}

/** Request body for `POST /members/:memberId/pathway`. */
export interface StartPathwayInput {
  pathway: Pathway;
  project: string;
  level: Level;
}
