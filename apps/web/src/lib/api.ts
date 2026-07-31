export interface Greeting {
  message: string;
  service: string;
  timestamp: string;
}

/**
 * Server-side code talks to Nest directly; the browser goes through the
 * `/api` rewrite in next.config.ts, so it never needs a cross-origin URL.
 */
const SERVER_API_URL = process.env.API_URL ?? 'http://localhost:4000';

function endpoint(path: string) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return typeof window === 'undefined'
    ? `${SERVER_API_URL}/api${suffix}`
    : `/api${suffix}`;
}

export async function apiFetch<T>(path = ''): Promise<T> {
  const res = await fetch(endpoint(path), { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`API responded with ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}
