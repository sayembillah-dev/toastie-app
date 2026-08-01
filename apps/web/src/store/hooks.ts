import { useDispatch, useSelector } from 'react-redux';

import type { AppDispatch, RootState } from './index';

/** Pre-typed hooks — components should always reach for these two rather than
 * the untyped `useDispatch` / `useSelector` from react-redux. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
