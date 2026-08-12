import { EnvelopeSimple, UserPlus } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';

import { PersonAvatar } from '@/components/ui/person-avatar';
import type { Guest } from '@/lib/people/guests';
import {
  getGuestFullName,
  getGuestInitials,
  getGuestStage,
  getGuestSwatch,
} from '@/lib/people/guests';

interface GuestCardProps {
  guest: Guest;
}

const VISIT_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatVisitDate(iso: string): string {
  return iso ? VISIT_DATE_FMT.format(new Date(iso)) : 'No visits yet';
}

export function GuestCard({ guest }: GuestCardProps) {
  const fullName = getGuestFullName(guest);
  const initials = getGuestInitials(guest);
  const swatch = getGuestSwatch(guest.id);

  return (
    <Link
      href={`/people/${guest.id}`}
      aria-label={`Open profile for ${fullName}`}
      className="group relative block overflow-hidden rounded-xl border border-line bg-canvas transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
    >
      <div className="h-16 bg-emerald-700 px-3 pt-2.5">
        <div className="flex items-start justify-end text-white/80">
          {/* The pipeline stage rather than a "Guest" label — inside the Guests
           * tab the type is a given, and this is what the board tracks. */}
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            {getGuestStage(guest.stage).label}
          </span>
        </div>
      </div>

      <PersonAvatar
        src={guest.avatarUrl}
        initials={initials}
        swatch={swatch}
        sizeClass="size-12"
        textClass="text-sm tracking-wide"
        className="absolute left-1/2 top-10 -translate-x-1/2 ring-4 ring-canvas transition-transform duration-300 ease-out group-hover:scale-110"
      />

      <div className="px-3.5 pb-4 pt-8">
        <div className="text-center">
          <h3 className="text-sm font-semibold text-ink">{fullName}</h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            {guest.visitCount === 1 ? 'First visit' : `${guest.visitCount} visits`}
          </p>
        </div>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
              First visit
            </div>
            <div className="mt-0.5 text-xs font-semibold text-ink">
              {formatVisitDate(guest.firstVisit)}
            </div>
          </div>
          <div className="min-w-0 text-right">
            <div className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
              Last visit
            </div>
            <div className="mt-0.5 text-xs font-semibold text-ink">
              {formatVisitDate(guest.lastVisit)}
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-xs text-ink-soft">
          {guest.invitedBy ? (
            <div className="flex items-center gap-1.5">
              <UserPlus size={12} weight="bold" className="shrink-0 text-ink-muted" />
              <span className="truncate">Invited by {guest.invitedBy}</span>
            </div>
          ) : null}
          {guest.email ? (
            <div className="flex items-center gap-1.5">
              <EnvelopeSimple size={12} weight="bold" className="shrink-0 text-ink-muted" />
              <span className="truncate">{guest.email}</span>
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
