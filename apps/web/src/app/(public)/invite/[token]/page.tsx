import type { Metadata } from 'next';

import { InviteLandingPage } from '@/components/invites/invite-landing-page';
import { apiFetch } from '@/lib/api';

interface InvitePreviewMeta {
  state: 'valid' | 'expired' | 'accepted' | 'revoked';
  clubName: string;
}

type InvitePageProps = { params: Promise<{ token: string }> };

const FALLBACK_TITLE = "You're invited to Toastie";
const FALLBACK_DESCRIPTION = 'Open this link to accept your Toastmasters club invite.';

/** Per-invite `<head>` tags so the link preview shown by iMessage, WhatsApp,
 * Slack, etc. names the actual club instead of the generic site title —
 * see the pasted-link screenshot this was requested from. Invite tokens are
 * single-use secrets, so `noindex` keeps them out of search results even
 * though crawlers still fetch this for the preview. */
export async function generateMetadata({ params }: InvitePageProps): Promise<Metadata> {
  const { token } = await params;
  const preview = await apiFetch<InvitePreviewMeta>(`/public/invites/${token}`).catch(() => null);

  const title =
    preview && preview.state === 'valid' ? `Join ${preview.clubName} on Toastie` : FALLBACK_TITLE;
  const description =
    preview && preview.state === 'valid'
      ? `You've been invited to join ${preview.clubName} on Toastie. Tap to accept.`
      : FALLBACK_DESCRIPTION;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  return <InviteLandingPage token={token} />;
}
