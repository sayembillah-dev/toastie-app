'use client';

import { useEffect } from 'react';

import { useAppDispatch } from '@/store/hooks';
import { type BreadcrumbCrumb, breadcrumbCleared, breadcrumbSet } from '@/store/ui-slice';

import { setMobileTitle } from '../lib/ui/mobile-title-slot';

interface PageBreadcrumbProps {
  /** Full trail — for routes with more than one dynamic segment whose human
   * names live in data (`/district/[divisionId]/[areaId]`). Wins over `label`
   * when both are provided. */
  trail?: BreadcrumbCrumb[];
  /** Overrides the label on the last crumb the shell would compute from the
   * pathname. Useful for `/education/[memberId]` and friends where the URL
   * carries an id but the crumb should read as a name. */
  label?: string;
  /** Replaces the shell's top-left MOBILE title (below md) with an
   * interactive control — e.g. the meeting switcher on the meeting detail
   * page. Desktop keeps the breadcrumb trail regardless. Registered in the
   * mobile-title slot (a ReactNode can't live in Redux); cleared on unmount.
   * */
  mobileTitle?: React.ReactNode;
}

/** Renders nothing — writes the screen's breadcrumb into `ui-slice` on mount
 * and clears it on unmount so `AppShell` (mounted once by the `(app)` layout)
 * can render the right trail regardless of which page owns the data. */
export function PageBreadcrumb({ trail, label, mobileTitle }: PageBreadcrumbProps) {
  const dispatch = useAppDispatch();
  const trailKey = trail ? JSON.stringify(trail) : null;

  useEffect(() => {
    dispatch(
      breadcrumbSet({
        trail: trail ?? null,
        label: label ?? null,
      }),
    );
    setMobileTitle(mobileTitle ?? null);
    return () => {
      dispatch(breadcrumbCleared());
      setMobileTitle(null);
    };
    // `trailKey` is a stable JSON of `trail` so the effect only re-runs on real
    // changes, not on every render. `mobileTitle` is likewise stable in
    // practice — pages that pass it re-render only when the underlying record
    // changes (the meeting detail screen re-renders on a refetch, not on the
    // timer's tick, which lives deeper in the tree).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, trailKey, label, mobileTitle]);

  return null;
}
