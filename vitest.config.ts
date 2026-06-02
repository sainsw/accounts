import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['__tests__/setup.ts'],
    // Don't descend into agent worktrees, which carry their own node_modules
    // (and a second React copy) and would otherwise pollute the run.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
