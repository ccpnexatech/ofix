import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    // Migrates the disposable test database (port 5433) before any test runs.
    globalSetup: ['test/global-setup.ts'],
  },
  plugins: [
    // Vitest's esbuild does not emit decorator metadata, which Nest DI relies on; SWC does.
    swc.vite({ module: { type: 'es6' } }),
  ],
});
