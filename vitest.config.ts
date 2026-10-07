import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // el módulo virtual solo existe con vite-plugin-pwa activo
      'virtual:pwa-register': fileURLToPath(
        new URL('./src/test/pwa-register-stub.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
