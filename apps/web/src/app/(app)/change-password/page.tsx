import { Suspense } from 'react';

import { ChangePasswordForm } from '@/components/me/change-password-form';
import { RouteFallback } from '@/components/route-fallback';

export default function ChangePasswordPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
      {/* ChangePasswordForm reads useSearchParams() (the `next` redirect
          target), which bails out of prerendering — the boundary is what keeps
          `next build` from failing. */}
      <Suspense fallback={<RouteFallback />}>
        <ChangePasswordForm />
      </Suspense>
    </div>
  );
}
