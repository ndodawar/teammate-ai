import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // Phase-4 evaluation runners live under eval/ and are executed only through
    // eval/vitest.eval.config.ts (see eval/README.md). Excluding them here keeps
    // `npm test` measuring the product alone (287 tests); it does not loosen any
    // product assertion.
    exclude: ['node_modules/**', '.git/**', 'eval/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
