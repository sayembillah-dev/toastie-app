import { ArrowSquareOut, Microphone } from '@phosphor-icons/react/dist/ssr';
import { Button } from 'antd';
import Link from 'next/link';
import { PersonAvatar } from '@/components/ui/person-avatar';
import type { Member } from '@/lib/education/members';
import { formatRoles, getInitials } from '@/lib/education/members';

/** Shared with the People/Education profile cards so the same member reads
 * with the same identity colour everywhere in the app. */
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

function formatJoinDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

interface ProfileHeroProps {
  member: Member;
  joinedAt: string;
  meetingsAttended: number;
  onRequestSlot: () => void;
}

/** The LinkedIn-shaped bit of the page: a banner with the avatar overlapping
 * it, a headline built from role + current pursuit, and the one action that
 * matters most from this screen — asking the VPE for a slot. */
export function ProfileHero({
  member,
  joinedAt,
  meetingsAttended,
  onRequestSlot,
}: ProfileHeroProps) {
  const fullName = `${member.firstName} ${member.lastName}`;
  const initials = getInitials(member);
  const swatch = AVATAR_PALETTE[hashString(member.id) % AVATAR_PALETTE.length];
  const roleLabel = formatRoles(member);
  const headline = member.pathway
    ? `${roleLabel} · Pursuing ${member.pathway}${member.level ? `, Level ${member.level}` : ''}`
    : roleLabel;

  return (
    <header className="relative overflow-hidden rounded-2xl border border-line bg-canvas">
      <div
        aria-hidden
        className="h-24 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 sm:h-28"
      />
      <div className="relative px-5 pb-5 sm:px-6">
        <PersonAvatar
          src={member.avatarUrl}
          initials={initials}
          swatch={swatch}
          sizeClass="size-22"
          textClass="text-2xl tracking-wide"
          className="absolute -top-11 left-5 ring-4 ring-canvas sm:left-6"
        />

        <div className="flex flex-col gap-4 pt-13 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-ink">{fullName}</h1>
            <p className="mt-1 text-sm text-ink-soft">{headline}</p>
            <p className="mt-1.5 text-xs text-ink-muted">
              Member since {formatJoinDate(joinedAt)} · {meetingsAttended} meetings attended
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="primary"
              size="middle"
              icon={<Microphone size={14} weight="bold" />}
              onClick={onRequestSlot}
            >
              Request speech slot
            </Button>
            <Link href={`/education/${member.id}`}>
              <Button
                type="default"
                size="middle"
                icon={<ArrowSquareOut size={14} weight="bold" />}
              >
                Pathway detail
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
