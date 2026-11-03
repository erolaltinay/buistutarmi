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
          include: ['apps/web/lib/**/*.test.ts'],
        },
      },
    ],
  },
});
