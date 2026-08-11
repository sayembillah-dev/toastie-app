import {
  EnvelopeSimple,
  FacebookLogo,
  Globe,
  InstagramLogo,
  LinkedinLogo,
  Phone,
  TiktokLogo,
  WhatsappLogo,
  XLogo,
  YoutubeLogo,
} from '@phosphor-icons/react/dist/ssr';

import type { Guest, GuestSocial, SocialPlatform } from '@/lib/people/guests';
import { getSocialPlatform } from '@/lib/people/guests';

interface GuestInfoProps {
  guest: Guest;
}

/** WhatsApp deeplinks need the full international number — storage is the
 * local 11-digit form (`0XXXXXXXXXX`), so drop the leading `0` and prepend
 * the BD country code. */
function toWhatsappNumber(phone: string): string {
  return `880${phone.replace(/\D/g, '').replace(/^0/, '')}`;
}

interface ContactRow {
  label: string;
  value: string;
  href: string;
  icon: React.ReactNode;
  external?: boolean;
}

function buildContactRows(guest: Guest): ContactRow[] {
  const rows: ContactRow[] = [];
  if (guest.phone) {
    rows.push({
      label: 'Phone',
      value: guest.phone,
      href: `tel:${guest.phone}`,
      icon: <Phone size={16} weight="bold" />,
    });
  }
  /* WhatsApp only earns its own row when it differs from the phone; otherwise
   * the WhatsApp button in the hero already covers it and a duplicate line
   * would just add noise. */
  if (guest.whatsapp && guest.whatsapp !== guest.phone) {
    rows.push({
      label: 'WhatsApp',
      value: guest.whatsapp,
      href: `https://wa.me/${toWhatsappNumber(guest.whatsapp)}`,
      icon: <WhatsappLogo size={16} weight="fill" />,
      external: true,
    });
  }
  if (guest.email) {
    rows.push({
      label: 'Email',
      value: guest.email,
      href: `mailto:${guest.email}`,
      icon: <EnvelopeSimple size={16} weight="bold" />,
      external: true,
    });
  }
  return rows;
}

/** One icon per known platform. `other` and `website` share the globe — they
 * both mean "just a URL" as far as the UI is concerned. */
const SOCIAL_ICONS: Record<SocialPlatform, React.ReactNode> = {
  linkedin: <LinkedinLogo size={18} weight="fill" />,
  facebook: <FacebookLogo size={18} weight="fill" />,
  instagram: <InstagramLogo size={18} weight="fill" />,
  youtube: <YoutubeLogo size={18} weight="fill" />,
  twitter: <XLogo size={18} weight="fill" />,
  tiktok: <TiktokLogo size={18} weight="fill" />,
  website: <Globe size={18} weight="bold" />,
  other: <Globe size={18} weight="bold" />,
};

function socialIcon(platform: SocialPlatform): React.ReactNode {
  return SOCIAL_ICONS[platform] ?? SOCIAL_ICONS.other;
}

function socialLabel(social: GuestSocial): string {
  return getSocialPlatform(social.platform).label;
}

export function GuestInfo({ guest }: GuestInfoProps) {
  const contactRows = buildContactRows(guest);
  const socials = guest.socials ?? [];
  const hasBio = Boolean(guest.bio?.trim());
  const hasNotes = Boolean(guest.notes?.trim());
  const hasAnything = contactRows.length > 0 || socials.length > 0 || hasBio || hasNotes;

  return (
    <section
      aria-label="Guest information"
      className="rounded-2xl border border-line bg-canvas p-5 sm:p-6"
    >
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Information</h2>
        {hasAnything ? null : (
          <span className="text-xs text-ink-muted">Add details once you meet</span>
        )}
      </header>

      {!hasAnything ? (
        <p className="text-sm text-ink-muted">
          No phone number, socials, bio, or notes on file yet.
        </p>
      ) : null}

      {contactRows.length > 0 ? (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {contactRows.map((row) => (
            <div key={row.label} className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-fill text-ink-soft"
              >
                {row.icon}
              </span>
              <div className="min-w-0">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  {row.label}
                </dt>
                <dd className="mt-0.5">
                  <a
                    href={row.href}
                    target={row.external ? '_blank' : undefined}
                    rel={row.external ? 'noopener noreferrer' : undefined}
                    className="break-all text-sm font-medium text-ink hover:underline"
                  >
                    {row.value}
                  </a>
                </dd>
              </div>
            </div>
          ))}
        </dl>
      ) : null}

      {socials.length > 0 ? (
        <div className={contactRows.length > 0 ? 'mt-5 border-t border-line pt-5' : ''}>
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Socials
          </h3>
          <ul className="flex flex-wrap gap-2">
            {socials.map((social) => {
              const label = socialLabel(social);
              return (
                <li key={`${social.platform}-${social.url}`}>
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${label} (opens in a new tab)`}
                    title={label}
                    className="flex size-10 items-center justify-center rounded-full border border-line bg-canvas text-ink-soft transition-colors hover:border-line-strong hover:bg-fill hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                  >
                    {socialIcon(social.platform)}
                    <span className="sr-only">{label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {hasBio ? (
        <div
          className={
            contactRows.length > 0 || socials.length > 0 ? 'mt-5 border-t border-line pt-5' : ''
          }
        >
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Bio
          </h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{guest.bio}</p>
        </div>
      ) : null}

      {hasNotes ? (
        <div
          className={
            contactRows.length > 0 || socials.length > 0 || hasBio
              ? 'mt-5 border-t border-line pt-5'
              : ''
          }
        >
          <h3 className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              Notes
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
              Club-only
            </span>
          </h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{guest.notes}</p>
        </div>
      ) : null}
    </section>
  );
}
