import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/__tests__/**/*.test.{js,jsx}'],
    setupFiles: ['src/__tests__/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Las páginas y servicios requieren tests de integración/E2E.
      // El umbral se aplica solo sobre los módulos con tests unitarios reales.
      include: [
        'src/hooks/**',
        'src/stores/**',
        'src/utils/**',
        'src/components/ui/RoleGuard.jsx',
      ],
      exclude: [
        'src/hooks/useSyncManager.js',
        // Stores de estado global: requieren tests de integración E2E, no unitarios
        'src/stores/authStore.js',
        'src/stores/notificationsStore.js',
      ],
      thresholds: {
        lines:      60,
        branches:   50,
        functions:  60,
        statements: 60,
      },
    },
  },
});
