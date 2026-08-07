'use client';

import { useParams, useSearchParams } from 'next/navigation';

import { PublicCredentialsPage } from '@/components/org/public-credentials-page';

export default function CredentialsPage() {
  const params = useParams<{ userId: string }>();
  const search = useSearchParams();
  const userId = params?.userId ?? '';
  const token = search?.get('t') ?? '';

  return <PublicCredentialsPage userId={userId} token={token} />;
}
