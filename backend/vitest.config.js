import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.js', 'tests/**/*.test.js'],
    testTimeout: 20000,
    reporters: ['verbose'],
    env: {
      // Force HS256 fallback so test tokens are verifiable without RSA keys
      JWT_PRIVATE_KEY: '',
      JWT_PUBLIC_KEY: '',
      JWT_SECRET: 'dev-secret-change-in-production',
      // env.js exige DATABASE_URL al cargar app.js; los tests mockean los modelos y nunca conectan.
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/gestor_jal_test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js'],
      exclude: [
        'src/index.js',
        'src/swagger.js',
        'src/services/syncService.js',
      ],
      // NUNCA bajar estos valores — si CI falla, agregar tests, no bajar el umbral.
      thresholds: {
        lines:      50,
        branches:   25,
        functions:  40,
        statements: 50,
      },
    },
  },
});
