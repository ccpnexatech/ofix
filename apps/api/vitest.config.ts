import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
  plugins: [
    // Vitest's esbuild does not emit decorator metadata, which Nest DI relies on; SWC does.
    swc.vite({ module: { type: 'es6' } }),
  ],
});
