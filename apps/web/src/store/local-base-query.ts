import type { BaseQueryFn } from '@reduxjs/toolkit/query';

import type { LocalRequest } from '@/lib/local-db/handlers';
import { handleLocalRequest, LocalApiError } from '@/lib/local-db/handlers';

/** Same shape `fetchBaseQuery` rejects with, so `error.status === 404` checks in
 * components keep working after the swap to the real API. */
export interface LocalQueryError {
  status: number;
  data: { message: string };
}

/* localStorage is synchronous, which would make every query resolve before the
 * first paint and hide the loading states we are here to exercise. A small
 * delay keeps the pipeline honest about being async. */
const SIMULATED_LATENCY_MS = 140;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Routes RTK Query requests to the localStorage-backed handlers instead of the
 * network. Replacing this with
 * `fetchBaseQuery({ baseUrl: '/api' })` is the only change needed once the Nest
 * endpoints exist — `next.config.ts` already proxies `/api/*` to port 4000.
 */
export const localBaseQuery: BaseQueryFn<LocalRequest | string, unknown, LocalQueryError> = async (
  arg,
) => {
  const request: LocalRequest = typeof arg === 'string' ? { url: arg } : arg;

  await wait(SIMULATED_LATENCY_MS);

  try {
    return { data: handleLocalRequest(request) };
  } catch (error) {
    if (error instanceof LocalApiError) {
      return { error: { status: error.status, data: { message: error.message } } };
    }
    return {
      error: {
        status: 500,
        data: { message: error instanceof Error ? error.message : 'Unknown local API failure' },
      },
    };
  }
};
