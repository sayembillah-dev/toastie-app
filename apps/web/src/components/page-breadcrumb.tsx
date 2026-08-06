'use client';

import { useEffect } from 'react';

import { useAppDispatch } from '@/store/hooks';
import { type BreadcrumbCrumb, breadcrumbCleared, breadcrumbSet } from '@/store/ui-slice';

interface PageBreadcrumbProps {
  /** Full trail — for routes with more than one dynamic segment whose human
   * names live in data (`/district/[divisionId]/[areaId]`). Wins over `label`
   * when both are provided. */
  trail?: BreadcrumbCrumb[];
  /** Overrides the label on the last crumb the shell would compute from the
   * pathname. Useful for `/education/[memberId]` and friends where the URL
   * carries an id but the crumb should read as a name. */
  label?: string;
}

/** Renders nothing — writes the screen's breadcrumb into `ui-slice` on mount
 * and clears it on unmount so `AppShell` (mounted once by the `(app)` layout)
 * can render the right trail regardless of which page owns the data. */
export function PageBreadcrumb({ trail, label }: PageBreadcrumbProps) {
  const dispatch = useAppDispatch();
  const trailKey = trail ? JSON.stringify(trail) : null;

  useEffect(() => {
    dispatch(
      breadcrumbSet({
        trail: trail ?? null,
        label: label ?? null,
      }),
    );
    return () => {
      dispatch(breadcrumbCleared());
    };
    // `trailKey` is a stable JSON of `trail` so the effect only re-runs on real
    // changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, trailKey, label]);

  return null;
}
