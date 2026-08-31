import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Tests cover the pure-TypeScript core only — the authorization engine and the
 * domain helpers around it — matching where docs/TDD.md section 12 says the web
 * repo's tests concentrate (`can.test.ts`).
 *
 * Nothing here renders a component. React Native needs a Metro-shaped module
 * resolver that Vitest does not have, and the value in testing `can()` does not
 * depend on solving that.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(fileURLToPath(new URL('.', import.meta.url)), './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
