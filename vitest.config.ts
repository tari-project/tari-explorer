import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      },
      exclude: [
        'node_modules/**',
        'build/**',
        'coverage/**',
        '**/__tests__/**',
        '**/vitest.config.ts',
        '**/eslint.config.js',
        'applications/minotari_app_grpc/**',
        'script.ts' // bytecode disassembler is complex to test
      ]
    }
  }
})
