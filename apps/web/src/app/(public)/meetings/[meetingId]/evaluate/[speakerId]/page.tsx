import { Suspense } from 'react';

import { EvaluatePage } from '@/components/evaluation/evaluate-page';
import { RouteFallback } from '@/components/route-fallback';

export default function EvaluateSpeakerPage() {
  // EvaluatePage reads useSearchParams(), which bails out of prerendering —
  // see RouteFallback for why the boundary is required at build time.
  return (
    <Suspense fallback={<RouteFallback />}>
      <EvaluatePage />
    </Suspense>
  );
}
