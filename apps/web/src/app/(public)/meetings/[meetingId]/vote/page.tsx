import { Suspense } from 'react';

import { PublicVotePage } from '@/components/meetings/public-vote-page';
import { RouteFallback } from '@/components/route-fallback';

export default function MeetingVotePage() {
  // PublicVotePage reads useSearchParams(), which bails out of prerendering —
  // see RouteFallback for why the boundary is required at build time.
  return (
    <Suspense fallback={<RouteFallback />}>
      <PublicVotePage />
    </Suspense>
  );
}
