import { describe, expect, it } from 'vitest';

import { normalizeOrigin } from './config';

/**
 * Regression cover for a bug that reached a running app: the deployed API is
 * reached at `https://host/api`, that whole URL was put in EXPO_PUBLIC_API_URL,
 * and the client appended its own prefix — producing `/api/api/auth/login` and
 * a bare "Cannot POST" from the server.
 */
describe('normalizeOrigin', () => {
  it('accepts a bare origin', () => {
    expect(normalizeOrigin('https://toastie.example.com')).toBe('https://toastie.example.com');
  });

  it('strips a trailing /api so the prefix is not doubled', () => {
    expect(normalizeOrigin('https://toastie.example.com/api')).toBe('https://toastie.example.com');
  });

  it('strips a trailing slash', () => {
    expect(normalizeOrigin('https://toastie.example.com/')).toBe('https://toastie.example.com');
  });

  it('strips a trailing slash and prefix together', () => {
    expect(normalizeOrigin('https://toastie.example.com/api/')).toBe('https://toastie.example.com');
  });

  it('tolerates surrounding whitespace', () => {
    expect(normalizeOrigin('  http://localhost:4000  ')).toBe('http://localhost:4000');
  });

  it('keeps a sub-path deployment, removing only the prefix', () => {
    expect(normalizeOrigin('https://host.example.com/toastie/api')).toBe(
      'https://host.example.com/toastie',
    );
  });

  it('does not eat a path that merely starts with "api"', () => {
    // The match is anchored, so /apiary survives.
    expect(normalizeOrigin('https://host.example.com/apiary')).toBe(
      'https://host.example.com/apiary',
    );
  });

  it('treats unset, empty, and whitespace-only as unconfigured', () => {
    expect(normalizeOrigin(undefined)).toBe(null);
    expect(normalizeOrigin('')).toBe(null);
    expect(normalizeOrigin('   ')).toBe(null);
  });
});
