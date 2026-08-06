import type { ModuleKey, ModulePermission } from '@/lib/permissions/permissions';

export const OFFICER_ROLES = [
  'President',
  'VPE',
  'VPM',
  'VPPR',
  'Secretary',
  'Treasurer',
  'SAA',
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
  /** Per-module overrides on top of the role-based default in
   * `lib/permissions/permissions.ts`. Only modules a Club Admin has
   * explicitly touched appear here. */
  permissions?: Partial<Record<ModuleKey, ModulePermission>>;
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

/** Fields the Club Admin "Add member" form writes. `roles` defaults to
 * `['Member']` server-side when omitted. */
export type CreateMemberInput = Pick<Member, 'firstName' | 'lastName'> & {
  roles?: OfficerRole[];
};

/** Fields the Club Admin "Edit member" form can write. Status, admin flag and
 * permissions each have their own dedicated endpoint — this one is plain
 * profile/role editing. */
export type UpdateMemberInput = Partial<Pick<Member, 'firstName' | 'lastName' | 'roles'>>;

export const SEED_MEMBERS: Member[] = [
  {
    id: 'm-01',
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
    firstName: 'Riley',
    lastName: 'Novak',
    roles: ['Member'],
    isClubAdmin: false,
    status: 'active',
  },
  {
    id: 'm-16',
    firstName: 'Amelia',
    lastName: 'Fischer',
    roles: ['Member'],
    isClubAdmin: false,
    status: 'active',
  },
  {
    id: 'm-17',
    firstName: 'Tomas',
    lastName: 'Rivera',
    roles: ['Member'],
    isClubAdmin: false,
    status: 'active',
  },
  {
    id: 'm-18',
    firstName: 'Nadia',
    lastName: 'Haddad',
    roles: ['Member'],
    isClubAdmin: false,
    status: 'active',
  },
  {
    id: 'm-19',
    firstName: 'Oliver',
    lastName: 'Bennett',
    roles: ['Member'],
    isClubAdmin: false,
    status: 'active',
  },
  {
    id: 'm-20',
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
