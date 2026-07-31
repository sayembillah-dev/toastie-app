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
  role: OfficerRole;
  level: Level;
  pathway: Pathway;
}

export const MEMBERS_STORAGE_KEY = 'toastly.education.members.v1';

export const SEED_MEMBERS: Member[] = [
  { id: 'm-01', firstName: 'Aisha', lastName: 'Patel', role: 'President', level: 4, pathway: 'Presentation Mastery' },
  { id: 'm-02', firstName: 'Marcus', lastName: 'Chen', role: 'VPE', level: 5, pathway: 'Effective Coaching' },
  { id: 'm-03', firstName: 'Priya', lastName: 'Sharma', role: 'VPM', level: 3, pathway: 'Dynamic Leadership' },
  { id: 'm-04', firstName: 'Daniel', lastName: 'Ortiz', role: 'VPPR', level: 2, pathway: 'Innovative Planning' },
  { id: 'm-05', firstName: 'Sophia', lastName: 'Nakamura', role: 'Secretary', level: 3, pathway: 'Team Collaboration' },
  { id: 'm-06', firstName: 'Nathan', lastName: 'Brooks', role: 'Treasurer', level: 4, pathway: 'Strategic Relationships' },
  { id: 'm-07', firstName: 'Yara', lastName: 'Ibrahim', role: 'SAA', level: 2, pathway: 'Motivational Strategies' },
  { id: 'm-08', firstName: 'Liam', lastName: 'Reeves', role: 'Member', level: 1, pathway: 'Engaging Humor' },
  { id: 'm-09', firstName: 'Grace', lastName: 'Okafor', role: 'Member', level: 5, pathway: 'Visionary Communication' },
  { id: 'm-10', firstName: 'Rafael', lastName: 'Mendoza', role: 'Member', level: 2, pathway: 'Persuasive Influence' },
  { id: 'm-11', firstName: 'Hannah', lastName: 'Klein', role: 'Member', level: 3, pathway: 'Leadership Development' },
  { id: 'm-12', firstName: 'Kenji', lastName: 'Watanabe', role: 'Member', level: 1, pathway: 'Presentation Mastery' },
  { id: 'm-13', firstName: 'Zara', lastName: 'Ahmed', role: 'Member', level: 4, pathway: 'Dynamic Leadership' },
  { id: 'm-14', firstName: 'Ethan', lastName: 'Kowalski', role: 'Member', level: 2, pathway: 'Effective Coaching' },
];

export function getInitials(member: Pick<Member, 'firstName' | 'lastName'>): string {
  return `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase();
}

/* The members list lives in localStorage. `useSyncExternalStore` needs a
 * subscribe/snapshot pair with referentially stable snapshots, so we cache the
 * last-read raw string and only rebuild the parsed array when it changes. */

let cachedRaw: string | null = null;
let cachedMembers: Member[] = SEED_MEMBERS;

function writeSeed(): Member[] {
  const seedRaw = JSON.stringify(SEED_MEMBERS);
  window.localStorage.setItem(MEMBERS_STORAGE_KEY, seedRaw);
  cachedRaw = seedRaw;
  cachedMembers = SEED_MEMBERS;
  return SEED_MEMBERS;
}

function readMembersSnapshot(): Member[] {
  if (typeof window === 'undefined') return SEED_MEMBERS;
  const raw = window.localStorage.getItem(MEMBERS_STORAGE_KEY);
  if (raw === null) return writeSeed();
  if (raw === cachedRaw) return cachedMembers;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('members payload is not an array');
    cachedRaw = raw;
    cachedMembers = parsed as Member[];
    return cachedMembers;
  } catch {
    return writeSeed();
  }
}

function readMembersServerSnapshot(): Member[] {
  return SEED_MEMBERS;
}

function subscribeMembers(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: StorageEvent) => {
    if (event.key === MEMBERS_STORAGE_KEY) callback();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export const membersStore = {
  subscribe: subscribeMembers,
  getSnapshot: readMembersSnapshot,
  getServerSnapshot: readMembersServerSnapshot,
};
