'use client';

import { notFound, useParams } from 'next/navigation';
import { Suspense } from 'react';

import { PublicRolePage } from '@/components/meetings/public-role-page';
import { RouteFallback } from '@/components/route-fallback';
import type { RoleKind } from '@/lib/meetings/role-state';

const VALID_ROLES: readonly RoleKind[] = ['ah-counter', 'timer', 'grammarian'];

function isRoleKind(value: string): value is RoleKind {
  return (VALID_ROLES as readonly string[]).includes(value);
}

export default function MeetingRolePublicPage() {
  const params = useParams<{ role: string }>();
  const role = params?.role;

  if (!role || !isRoleKind(role)) {
    notFound();
  }

  // PublicRolePage reads useSearchParams(); the boundary keeps the prerender
  // pass from failing the build.
  return (
    <Suspense fallback={<RouteFallback />}>
      <PublicRolePage kind={role} />
    </Suspense>
  );
}
