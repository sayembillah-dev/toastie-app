'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { PublicCredentialsPage } from '@/components/org/public-credentials-page';
import { RouteFallback } from '@/components/route-fallback';

function CredentialsPageContent() {
  const params = useParams<{ userId: string }>();
  const search = useSearchParams();
  const userId = params?.userId ?? '';
  const token = search?.get('t') ?? '';

  return <PublicCredentialsPage userId={userId} token={token} />;
}

/** The `useSearchParams()` call above bails out of prerendering, so the
 * boundary has to sit above the component that reads it — hence the split into
 * an inner component rather than a wrapper inside the same function. */
export default function CredentialsPage() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <CredentialsPageContent />
    </Suspense>
  );
}
