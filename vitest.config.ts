import { defineConfig } from 'vitest/config';

// Standalone vitest config (no vite plugins needed: tests are pure TS).
// Kept separate from vite.config.ts because vitest's bundled vite types
// conflict with the project's vite 8 (rolldown) plugin types.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
