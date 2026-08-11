import type { Member } from '@/lib/education/members';

import type { TaskPriority } from './tasks';

export const PRIORITY_STYLES: Record<TaskPriority, { label: string; className: string }> = {
  High: { label: 'High', className: 'bg-rose-100 text-rose-800' },
  Medium: { label: 'Medium', className: 'bg-amber-100 text-amber-800' },
  Low: { label: 'Low', className: 'bg-slate-100 text-slate-700' },
};

const AVATAR_PALETTE = [
  { bg: '#DBEAFE', fg: '#1E3A8A' },
  { bg: '#D1FAE5', fg: '#064E3B' },
  { bg: '#FEF3C7', fg: '#78350F' },
  { bg: '#EDE9FE', fg: '#4C1D95' },
  { bg: '#FCE7F3', fg: '#831843' },
  { bg: '#CFFAFE', fg: '#164E63' },
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

export function personInitials(person: { firstName: string; lastName: string }): string {
  return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase();
}

export function personSwatch(personId: string): (typeof AVATAR_PALETTE)[number] {
  return AVATAR_PALETTE[hashString(personId) % AVATAR_PALETTE.length];
}

/** Officers only — a plain Member can create a task but isn't a valid
 * assignee, matching "Assigned to — search officers." `roles` always
 * includes `'Member'` for a plain roster entry, so "officer" here is anyone
 * whose roles carry something else too. Club Admins count as officers even
 * when that's their only role — `isClubAdmin` is carried as its own boolean
 * rather than folded into `roles` (see `Member.isClubAdmin`), so it needs its
 * own check here. */
export function officerOptions(members: Member[]): { value: string; label: string }[] {
  return members
    .filter((m) => m.isClubAdmin || m.roles.some((r) => r !== 'Member'))
    .map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}` }));
}
