import { UsersThree } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { PersonAvatar } from '@/components/ui/person-avatar';
import type { Member } from '@/lib/education/members';
import type { Meeting } from '@/lib/meetings/meetings';
import type { RoleAssignment } from '@/lib/meetings/role-assignments';
import { buildRoles } from '@/lib/meetings/roles';
import type { Guest } from '@/lib/people/guests';
import { getGuestFullName } from '@/lib/people/guests';

function initialsOf(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  return `${parts[0][0]}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase();
}

interface LineupCardProps {
  meeting: Meeting | null;
  roleAssignments: RoleAssignment[];
  membersById: Map<string, Member>;
  guestsById: Map<string, Guest>;
  currentMemberId: string | null;
}

/** Club-wide, not personal: who is holding every role at the next meeting, so
 * a member can see the whole slate — not just their own line — in one
 * glance. Reuses the same role list the Roles tab and agenda print from, so
 * this can never drift from what's actually assigned. */
export function LineupCard({
  meeting,
  roleAssignments,
  membersById,
  guestsById,
  currentMemberId,
}: LineupCardProps) {
  if (!meeting) return null;

  const roles = buildRoles(meeting);
  const assignmentByRole = new Map(roleAssignments.map((row) => [row.roleKey, row]));
  const filled = roles.filter((role) => assignmentByRole.has(role.key)).length;

  return (
    <article className="rounded-xl border border-line bg-canvas p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <UsersThree size={15} weight="bold" className="text-ink-muted" />
          This week&rsquo;s lineup
        </h2>
        <Link
          href={`/meetings/${meeting.id}`}
          className="text-xs font-medium text-ink-soft underline underline-offset-2 hover:text-ink"
        >
          Full agenda
        </Link>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {filled}/{roles.length} roles assigned for meeting #{meeting.meetingNumber}
      </p>

      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {roles.map((role) => {
          const assignment = assignmentByRole.get(role.key);
          const member = assignment?.membershipId ? membersById.get(assignment.membershipId) : null;
          const guest = assignment?.guestId ? guestsById.get(assignment.guestId) : null;
          const name = member ? getGuestFullName(member) : guest ? getGuestFullName(guest) : '';
          const isMe = Boolean(member && currentMemberId && member.id === currentMemberId);

          return (
            <li
              key={role.key}
              className={`flex items-center gap-2.5 rounded-lg p-2 ${isMe ? 'bg-emerald-50' : 'bg-fill/60'}`}
            >
              <PersonAvatar
                src={member?.avatarUrl ?? guest?.avatarUrl}
                initials={name ? initialsOf(name) : '—'}
                sizeClass="size-7"
                textClass="text-[10px]"
                fallbackClass={name ? 'bg-slate-700 text-white' : 'bg-fill text-ink-muted'}
              />
              <span className="min-w-0 flex-1 truncate text-xs text-ink-soft">{role.label}</span>
              <span
                className={`shrink-0 text-xs ${
                  isMe
                    ? 'font-semibold text-emerald-700'
                    : name
                      ? 'font-medium text-ink'
                      : 'text-ink-muted'
                }`}
              >
                {isMe ? 'You' : name || 'Unassigned'}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
