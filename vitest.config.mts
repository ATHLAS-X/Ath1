import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Integration tests share one Postgres schema, so they must not race.
    fileParallelism: false,
    maxWorkers: 1,
    setupFiles: ['tests/helpers/load-env.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/app/api/**/*.ts'],
      exclude: ['src/lib/db.ts'],
      reporter: ['text-summary', 'json-summary'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
