'use client';

import { useParams } from 'next/navigation';

import { InviteAcceptPage } from '@/components/invites/invite-accept-page';

export default function InviteAcceptRoute() {
  const params = useParams<{ token: string }>();
  return <InviteAcceptPage token={params?.token ?? ''} />;
}
