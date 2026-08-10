import { Spin } from 'antd';

/** Full-viewport spinner used as the `<Suspense>` fallback for routes whose
 * content reads `useSearchParams()`.
 *
 * That hook forces a client-side bailout during prerendering, so `next build`
 * hard-fails unless a Suspense boundary sits above the component calling it —
 * the build error is `missing-suspense-with-csr-bailout`. The boundary lets
 * Next prerender this fallback as the static shell and hydrate the real
 * content on the client, where the query string actually exists.
 *
 * Matches the inline loading state already used by `public-credentials-page`
 * so a bailout is visually indistinguishable from a normal data fetch. */
export function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spin size="large" />
    </div>
  );
}
