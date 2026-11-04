import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'engine',
          include: ['packages/engine/test/**/*.test.ts', 'tests/engine/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'archetypes',
          include: ['packages/archetypes/test/**/*.test.ts', 'scripts/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'web',
          testTimeout: 30_000,
          include: ['apps/web/lib/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'pdf',
          testTimeout: 30_000,
          include: ['packages/pdf/test/**/*.test.ts'],
        },
      },
    ],
  },
});
