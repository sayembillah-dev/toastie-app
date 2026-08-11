'use client';

/* eslint-disable @next/next/no-img-element -- see the note below: the source is
   a presigned S3 URL, which next/image cannot usefully optimise. File-level
   rather than next-line so Biome's suppression can sit against the element. */

/** One person's face, wherever the app shows one.
 *
 * Every roster surface used to render initials unconditionally, because the
 * member wire carried no photo at all — `Membership` denormalises name and
 * email from `User` but not the avatar. Now that `MemberWire.avatarUrl`
 * exists, this is the single place that decides picture-or-initials, so a
 * screen cannot accidentally keep showing initials for someone who has
 * uploaded one.
 *
 * `src` is a presigned S3 URL whose query string is re-minted on every
 * response, so `next/image` is deliberately not used: it would re-run
 * optimisation on each render and needs a remote-pattern allowlist for a host
 * whose URLs already expire on their own.
 */

interface PersonAvatarProps {
  /** Presigned URL. Falsy — unclaimed roster row, or no photo set — falls
   * back to initials. */
  src?: string | null;
  /** Shown when there is no photo. Already uppercased by the callers'
   * `getInitials` helpers. */
  initials: string;
  /** Tailwind size utility, matching whatever the surrounding row used
   * before (`size-9` in list rows, `size-20` in profile heroes). */
  sizeClass?: string;
  /** Font size for the initials, paired with `sizeClass` by the caller. */
  textClass?: string;
  /** Optional per-person background/foreground, for the surfaces that already
   * hash a colour out of the person's id. Ignored when a photo is shown. */
  swatch?: { bg: string; fg: string };
  /** Overrides the default `bg-fill text-ink-soft` on the initials circle —
   * the meeting lineups tint theirs by whether the slot is filled. Ignored
   * when a photo is shown, and when `swatch` is set. */
  fallbackClass?: string;
  className?: string;
}

export function PersonAvatar({
  src,
  initials,
  sizeClass = 'size-9',
  textClass = 'text-xs',
  swatch,
  fallbackClass,
  className = '',
}: PersonAvatarProps) {
  const shape = `${sizeClass} shrink-0 rounded-full ${className}`;

  if (src) {
    return (
      // biome-ignore lint/performance/noImgElement: presigned S3 URL — see the note at the top of this file.
      <img src={src} alt="" aria-hidden className={`${shape} object-cover`} />
    );
  }

  return (
    <span
      aria-hidden
      className={`${shape} flex items-center justify-center font-semibold ${textClass} ${
        swatch ? '' : (fallbackClass ?? 'bg-fill text-ink-soft')
      }`}
      style={swatch ? { backgroundColor: swatch.bg, color: swatch.fg } : undefined}
    >
      {initials}
    </span>
  );
}
