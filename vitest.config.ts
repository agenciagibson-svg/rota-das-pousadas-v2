import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  test: {
    // Testes de UI podem optar por jsdom com @vitest-environment jsdom.
    environment: 'node',
    globals: true,
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // `server-only` é um alias interno do Next.js, não um pacote npm real —
      // o Vite puro não resolve sozinho. Ver lib/testing/server-only-stub.ts.
      'server-only': fileURLToPath(new URL('./lib/testing/server-only-stub.ts', import.meta.url)),
    },
  },
})
