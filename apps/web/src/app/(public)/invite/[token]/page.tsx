'use client';

import { useParams } from 'next/navigation';

import { InviteLandingPage } from '@/components/invites/invite-landing-page';

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  return <InviteLandingPage token={params?.token ?? ''} />;
}
