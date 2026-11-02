import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const PURITY = 'Hesap motoru saf olmalı (CLAUDE.md kural 1).';

// Motorda yasak olan global adlar: zaman, rastgelelik, ağ, DOM, tarayıcı depolaması, süreç.
export const engineForbiddenGlobals = [
  'Date',
  'fetch',
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'navigator',
  'location',
  'process',
  'globalThis',
  'self',
  'performance',
  'crypto',
  'XMLHttpRequest',
  'WebSocket',
  'setTimeout',
  'setInterval',
  'require',
];

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      '**/next-env.d.ts',
      'prototype/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['packages/engine/src/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-globals': [
        'error',
        ...engineForbiddenGlobals.map((name) => ({ name, message: PURITY })),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: PURITY },
        { object: 'globalThis', message: PURITY },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportDeclaration[source.value=/^[^.]/]',
          message: 'Motor dış paket içe aktaramaz; sadece göreli importlar (0 bağımlılık).',
        },
        { selector: 'ImportExpression', message: PURITY },
      ],
    },
  },
);
