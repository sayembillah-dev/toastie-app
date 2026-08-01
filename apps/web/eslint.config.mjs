import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

/**
 * ESLint is deliberately the *thin* layer here. Biome owns formatting, import
 * sorting, and general JS/TS correctness — it does the same work in a fraction
 * of the time — so this config keeps only what Biome has no equivalent for:
 * the `@next/next/*` rules and the React Hooks rules.
 *
 * Note that `core-web-vitals` already bundles `eslint-config-next/typescript`,
 * so there is no second spread; the rules block below just silences the parts
 * of that bundle Biome has already reported on.
 *
 * @type {import('eslint').Linter.Config[]}
 */
const eslintConfig = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  ...nextCoreWebVitals,
  {
    rules: {
      // Covered by Biome's `correctness` + `suspicious` groups.
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/prefer-as-const': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-unused-vars': 'off',
      // Covered by Biome's a11y group and JSX correctness rules.
      'react/jsx-key': 'off',
      'react/jsx-no-duplicate-props': 'off',
      'react/jsx-no-target-blank': 'off',
      'react/no-children-prop': 'off',
      'react/no-danger-with-children': 'off',
    },
  },
];

export default eslintConfig;
