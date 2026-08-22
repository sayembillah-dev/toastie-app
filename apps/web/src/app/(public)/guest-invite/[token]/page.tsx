import type { Metadata } from 'next';

import { GuestInvitePage } from '@/components/people/guest-invite-page';
import { apiFetch } from '@/lib/api';

interface GuestInvitePreviewMeta {
  clubName: string;
}

type GuestInvitePageProps = { params: Promise<{ token: string }> };

const FALLBACK_TITLE = 'Guest sign-up';
const FALLBACK_DESCRIPTION = 'Open this link to add yourself to the club’s guest list.';

/** Per-link `<head>` tags so the preview shown by iMessage, WhatsApp, Slack,
 * etc. names the actual club instead of the generic site title — mirrors
 * `/invite/:token`. Invite tokens are secrets, so `noindex` keeps them out of
 * search results even though crawlers still fetch this for the preview. */
export async function generateMetadata({ params }: GuestInvitePageProps): Promise<Metadata> {
  const { token } = await params;
  const preview = await apiFetch<GuestInvitePreviewMeta>(`/public/guest-invites/${token}`).catch(
    () => null,
  );

  const title = preview ? `Visit ${preview.clubName}` : FALLBACK_TITLE;
  const description = preview
    ? `Add yourself to the guest list at ${preview.clubName} — just your name and number.`
    : FALLBACK_DESCRIPTION;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary', title, description },
  };
}

export default async function GuestInvite({ params }: GuestInvitePageProps) {
  const { token } = await params;
  return <GuestInvitePage token={token} />;
}
