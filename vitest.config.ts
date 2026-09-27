import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // The crawler talks to a localhost server; give slow CI machines room.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
