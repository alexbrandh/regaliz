import coreWebVitals from 'eslint-config-next/core-web-vitals';

/**
 * Flat config (ESLint 9). Sustituye a .eslintrc.json, que ESLint 9 ya no lee.
 * `eslint-config-next/core-web-vitals` incluye next, next/typescript y las
 * reglas de core web vitals, que es justo lo que extendia la config antigua.
 */
export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'public/**',
      'supabase/**',
      'scripts/**',
      '*.config.js',
      '*.config.mjs',
    ],
  },
  ...coreWebVitals,
];
