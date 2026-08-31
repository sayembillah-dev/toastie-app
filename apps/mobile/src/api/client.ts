/**
 * The HTTP client. Everything that talks to the API goes through `request`.
 *
 * Responsibilities, in the order they bite:
 *
 *   Context header. Every authenticated request carries `X-Toastly-Context`
 *   naming the club or org unit being acted within. The API's `ContextGuard`
 *   answers a flat 403 `CONTEXT_NOT_HELD` when it does not match a real
 *   assignment (docs/TDD.md section 7.2).
 *
 *   Refresh rotation, single-flight. Refresh tokens rotate, and presenting one
 *   twice is read as theft: the API revokes the entire token family and every
 *   device sharing it gets logged out (docs/TDD.md section 6). A screen that fires
 *   four requests which all 401 would, without the lock below, present the same
 *   refresh token four times and log the user out of everything. The in-flight
 *   promise is not an optimization — it is what keeps rotation from eating
 *   itself.
 */

import { API_BASE_URL, CONTEXT_HEADER } from '@/lib/config';

export type TokenBundle = {
  accessToken: string;
  /** Opaque, not a JWT. The API stores only its hash (docs/ERD.md section 4.1). */
  refreshToken: string;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** The API's machine-readable code, e.g. `CONTEXT_NOT_HELD`. */
    readonly code: string | null,
    message: string,
    readonly body?: unknown,
    /**
     * Per-field validation messages, when the API sends them. Its 400 envelope
     * carries both a flat `message` array and a `fields` map keyed by property,
     * and a form wants the second one so each error lands on its own input.
     */
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The session is gone, not merely this request. */
  get isAuthFailure(): boolean {
    return this.status === 401;
  }
}

/** Thrown before any network call when `EXPO_PUBLIC_API_URL` is unset. */
export class ApiNotConfiguredError extends Error {
  constructor() {
    super(
      'EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and point it at the API origin.',
    );
    this.name = 'ApiNotConfiguredError';
  }
}

type ClientDeps = {
  getTokens: () => TokenBundle | null;
  setTokens: (tokens: TokenBundle | null) => void | Promise<void>;
  /** The active `X-Toastly-Context` value, or null when acting with none. */
  getContext: () => string | null;
  /** Called when refresh fails and the session cannot be recovered. */
  onSessionExpired: () => void;
};

let deps: ClientDeps | null = null;

/** Wired once, by the session provider, before any request is made. */
export function configureApiClient(next: ClientDeps): void {
  deps = next;
}

let refreshInFlight: Promise<TokenBundle | null> | null = null;

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorFrom(response: Response, body: unknown): ApiError {
  const shape = (body ?? {}) as {
    code?: string;
    message?: string | string[];
    error?: string;
    fields?: Record<string, string[]>;
  };
  const message = Array.isArray(shape.message)
    ? shape.message.join(', ')
    : (shape.message ?? shape.error ?? `Request failed with ${response.status}`);
  return new ApiError(response.status, shape.code ?? null, message, body, shape.fields);
}

/**
 * Exchange the current refresh token for a new pair. Concurrent callers share
 * one attempt — see the header note on family revocation.
 */
async function refreshTokens(): Promise<TokenBundle | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async (): Promise<TokenBundle | null> => {
    const current = deps?.getTokens();
    if (!current?.refreshToken) return null;

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });

    if (!response.ok) return null;

    // `auth/refresh` answers the API's `AuthResult` — `{ tokens, session }`,
    // not a bare token pair. Reading the wrong level here fails the refresh
    // silently and signs the user out on their first 401.
    const body = (await parseBody(response)) as { tokens?: TokenBundle } | null;
    const next = body?.tokens;
    if (!next?.accessToken || !next?.refreshToken) return null;

    await deps?.setTokens(next);
    return next;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Skip the auth header and the refresh dance — for `public/...` routes. */
  anonymous?: boolean;
  /** Override the active context, e.g. when acting on another club as a director. */
  context?: string | null;
  signal?: AbortSignal;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE_URL) throw new ApiNotConfiguredError();

  const url = `${API_BASE_URL}/${path.replace(/^\/+/, '')}`;

  const send = async (accessToken: string | null): Promise<Response> => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const context = options.context !== undefined ? options.context : deps?.getContext();
    if (context) headers[CONTEXT_HEADER] = context;

    return fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  };

  let response = await send(options.anonymous ? null : (deps?.getTokens()?.accessToken ?? null));

  // One retry, and only for an expired access token. A 403 means the server
  // considered the request and said no; refreshing would not change that.
  if (response.status === 401 && !options.anonymous) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      response = await send(refreshed.accessToken);
    } else {
      await deps?.setTokens(null);
      deps?.onSessionExpired();
    }
  }

  const body = await parseBody(response);
  if (!response.ok) throw errorFrom(response, body);
  return body as T;
}
