import { DotsThree } from '@phosphor-icons/react/dist/ssr';

import type { Member } from '@/lib/education/members';
import { getInitials } from '@/lib/education/members';

interface MemberCardProps {
  member: Member;
}

/** Paired pastel background + darker foreground for the initials circle. Each
 * entry stays contrast-safe on its own so the initials read cleanly. */
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

/** djb2-ish string hash. Stable across server and client so hydration matches
 * and the same member always lands on the same palette entry. */
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Directory card modelled on the "Profile" reference: a slate banner, a
 * circular initials badge that straddles the banner/body seam, then a stat
 * row for Level/Pathway, name, and officer role. */
export function MemberCard({ member }: MemberCardProps) {
  const fullName = `${member.firstName} ${member.lastName}`;
  const initials = getInitials(member);
  const swatch = AVATAR_PALETTE[hashString(member.id) % AVATAR_PALETTE.length];

  return (
    <article className="group relative overflow-hidden rounded-xl border border-line bg-canvas">
      <div className="h-16 bg-slate-700 px-3 pt-2.5">
        <div className="flex items-start justify-end text-white">
          <DotsThree size={16} weight="bold" aria-hidden />
        </div>
      </div>

      {/* Avatar overlaps the banner/body seam. ring-4 with the canvas colour
       * cuts a clean gap so the circle sits above both surfaces. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-10 flex size-12 -translate-x-1/2 items-center justify-center rounded-full ring-4 ring-canvas transition-transform duration-300 ease-out group-hover:scale-110"
        style={{ backgroundColor: swatch.bg, color: swatch.fg }}
      >
        <span className="text-sm font-semibold tracking-wide">{initials}</span>
      </div>

      <div className="px-3.5 pb-4 pt-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
              Level
            </div>
            <div className="mt-0.5 text-lg font-semibold leading-none text-ink">
              {member.level}
            </div>
          </div>
          <div className="min-w-0 text-right">
            <div className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
              Pathway
            </div>
            <div className="mt-0.5 text-xs font-semibold leading-snug text-ink">
              {member.pathway}
            </div>
          </div>
        </div>

        <div className="mt-3 text-center">
          <h3 className="text-sm font-semibold text-ink">{fullName}</h3>
          <p className="mt-0.5 text-xs text-ink-muted">{member.role}</p>
        </div>
      </div>
    </article>
  );
}
