'use client';

import {
  ArrowLeft,
  EnvelopeSimple,
  Phone,
  WarningCircle,
  WhatsappLogo,
} from '@phosphor-icons/react/dist/ssr';
import { skipToken } from '@reduxjs/toolkit/query';
import { Button } from 'antd';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { GuestActions } from '@/components/people/guest-actions';
import { GuestInfo } from '@/components/people/guest-info';
import { AccessGate } from '@/components/permissions/access-gate';
import { PersonAvatar } from '@/components/ui/person-avatar';
import type { Guest } from '@/lib/people/guests';
import { getGuestInitials, getGuestStage, getGuestSwatch } from '@/lib/people/guests';
import { useGetGuestQuery } from '@/store/api';
import { getApiErrorMessage, isNotFoundError } from '@/store/api-error';

const VISIT_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatVisitDate(iso: string): string {
  return iso ? VISIT_DATE_FMT.format(new Date(iso)) : 'No visits yet';
}

/** WhatsApp deeplinks need the full international number — storage is the
 * local 11-digit form (`0XXXXXXXXXX`), so drop the leading `0` and prepend
 * the BD country code. Also strips any stray non-digit that slipped in. */
function toWhatsappNumber(phone: string): string {
  return `880${phone.replace(/\D/g, '').replace(/^0/, '')}`;
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  href?: string;
  /** Not every guest has a phone or email; the button greys out when the target
   * data is missing rather than disappearing, so the row stays predictable. */
  disabled?: boolean;
  /** Landing on a WhatsApp deeplink or a `tel:` from an already-open app is
   * expected to jump the user off-site, so `_blank` keeps the profile alive
   * in the background. `mailto:` follows the same rule for consistency. */
  external?: boolean;
}

function ActionButton({ icon, label, href, disabled, external }: ActionButtonProps) {
  const isDisabled = disabled || !href;
  return (
    <Button
      size="middle"
      type="default"
      icon={icon}
      disabled={isDisabled}
      href={isDisabled ? undefined : href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="min-w-[6.5rem] flex-1 sm:flex-none"
    >
      {label}
    </Button>
  );
}

function StageBadge({ stage }: { stage: Guest['stage'] }) {
  const meta = getGuestStage(stage);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: meta.soft, color: meta.accent }}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ backgroundColor: meta.accent }}
      />
      {meta.label}
    </span>
  );
}

function ProfileHeader({ guest }: { guest: Guest }) {
  const fullName = `${guest.firstName} ${guest.lastName}`;
  const initials = getGuestInitials(guest);
  const swatch = getGuestSwatch(guest.id);
  const visitLabel =
    guest.visitCount === 0
      ? 'No visits yet'
      : guest.visitCount === 1
        ? '1 visit'
        : `${guest.visitCount} visits`;
  /* Falls back to phone so a guest who told us to WhatsApp them on the same
   * number they picked up on doesn't need the field twice. */
  const whatsappNumber = guest.whatsapp ?? guest.phone;

  return (
    <header className="overflow-hidden rounded-2xl border border-line bg-canvas">
      {/* Cover — a plain slate gradient so the avatar swatch is the only colour
       * that reads at a glance; the stage carries its own chip below. */}
      <div
        aria-hidden
        className="h-24 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 sm:h-36"
      />

      <div className="relative px-4 pb-5 pt-14 sm:px-6 sm:pt-16">
        {/* Avatar overlaps the cover/body seam. ring-4 with the canvas colour
         * cuts a clean gap so the circle floats above both surfaces. When the
         * guest has an uploaded photo it stands in for the initials swatch. */}
        <PersonAvatar
          src={guest.avatarUrl}
          initials={initials}
          swatch={swatch}
          sizeClass="size-20 sm:size-24"
          textClass="text-xl tracking-wide sm:text-2xl"
          className="absolute -top-10 left-4 ring-4 ring-canvas sm:-top-12 sm:left-6"
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-tight text-ink sm:text-2xl">{fullName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
              <StageBadge stage={guest.stage} />
              <span aria-hidden>·</span>
              <span>{visitLabel}</span>
              {guest.visitCount > 0 ? (
                <>
                  <span aria-hidden>·</span>
                  <span>Last visit {formatVisitDate(guest.lastVisit)}</span>
                </>
              ) : null}
            </div>
            {guest.invitedBy ? (
              <p className="mt-2 text-sm text-ink-soft">
                Invited by <span className="font-medium text-ink">{guest.invitedBy}</span>
              </p>
            ) : null}
          </div>

          {/* Actions — stretch full-width on phones so thumbs can hit them, but
           * relax to their natural size once there's room on the right. */}
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
            <ActionButton
              icon={<Phone size={16} weight="bold" />}
              label="Call"
              href={guest.phone ? `tel:${guest.phone}` : undefined}
              disabled={!guest.phone}
              external
            />
            <ActionButton
              icon={<WhatsappLogo size={16} weight="bold" />}
              label="WhatsApp"
              href={
                whatsappNumber ? `https://wa.me/${toWhatsappNumber(whatsappNumber)}` : undefined
              }
              disabled={!whatsappNumber}
              external
            />
            <ActionButton
              icon={<EnvelopeSimple size={16} weight="bold" />}
              label="Email"
              href={guest.email ? `mailto:${guest.email}` : undefined}
              disabled={!guest.email}
              external
            />
          </div>
        </div>
      </div>
    </header>
  );
}

function ProfileContent({ guest }: { guest: Guest }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <Link href="/people">
          <Button
            type="text"
            size="small"
            icon={<ArrowLeft size={14} className="text-ink-muted" />}
          >
            <span className="text-xs text-ink-soft">Back to People</span>
          </Button>
        </Link>
      </div>

      <ProfileHeader guest={guest} />

      {/* Mobile stacks actions above info so the primary controls sit at
       * thumb-height; desktop pins actions to a right rail alongside the
       * fuller information card. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="order-2 lg:order-none">
          <GuestInfo guest={guest} />
        </div>
        <div className="order-1 lg:order-none">
          <GuestActions guest={guest} />
        </div>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6" aria-hidden>
      <div className="h-7 w-32 animate-pulse rounded bg-fill-strong" />
      <div className="overflow-hidden rounded-2xl border border-line bg-canvas">
        <div className="h-24 animate-pulse bg-fill-strong sm:h-36" />
        <div className="flex flex-col gap-3 px-4 pb-5 pt-14 sm:px-6 sm:pt-16">
          <div className="h-6 w-56 animate-pulse rounded bg-fill-strong" />
          <div className="h-4 w-40 animate-pulse rounded bg-fill-strong" />
          <div className="mt-2 flex gap-2">
            <div className="h-9 w-24 animate-pulse rounded bg-fill-strong" />
            <div className="h-9 w-24 animate-pulse rounded bg-fill-strong" />
            <div className="h-9 w-24 animate-pulse rounded bg-fill-strong" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="order-2 h-56 animate-pulse rounded-2xl border border-line bg-fill lg:order-none" />
        <div className="order-1 h-40 animate-pulse rounded-2xl border border-line bg-fill lg:order-none" />
      </div>
    </div>
  );
}

/** Top-level client screen: resolves the guest from the URL, hands the name to
 * the shell for the breadcrumb, and renders the LinkedIn-style profile card. */
export function GuestProfileScreen() {
  const params = useParams<{ guestId: string }>();
  const guestId = params?.guestId;
  const { data: guest, isError, error } = useGetGuestQuery(guestId ?? skipToken);

  if (isError) {
    if (isNotFoundError(error)) notFound();

    return (
      <div className="mx-auto max-w-md rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
        <span
          aria-hidden
          className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
        >
          <WarningCircle size={18} weight="bold" />
        </span>
        <p className="text-sm font-medium text-ink">Could not load this guest</p>
        <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
      </div>
    );
  }

  if (!guest) {
    return <ProfileSkeleton />;
  }

  return (
    <>
      <PageBreadcrumb label={`${guest.firstName} ${guest.lastName}`} />
      <AccessGate resource="guest">
        <ProfileContent guest={guest} />
      </AccessGate>
    </>
  );
}
