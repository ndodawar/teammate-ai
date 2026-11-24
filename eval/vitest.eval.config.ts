import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Config khusus Fase 4. Dijalankan lewat:
 *   npx vitest run --config eval/vitest.eval.config.ts <file>
 *
 * Dipisah dari vitest.config.ts produk supaya `npm test` tetap hanya mengukur
 * produk (287 test), sementara harness evaluasi (yang memanggil engine langsung
 * dan menulis artefak ke eval/results) hanya jalan bila diminta.
 *
 * `include` sengaja dibatasi ke eval/** dan `test/` tetap tersedia untuk
 * kenyamanan, tapi eksperimen inti memakai file di eval/scripts/.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['eval/**/*.test.ts'],
    // Eksperimen boleh berjalan lama (perf, 20 skenario × 4 metode × 30 repeat).
    testTimeout: 120000,
  },
  resolve: {
    alias: {
      '@': repoRoot,
    },
  },
});
