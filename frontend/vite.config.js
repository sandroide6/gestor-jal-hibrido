import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const JAL_NOMBRE   = process.env.VITE_JAL_NOMBRE   || 'Gestor JAL';
const JAL_SHORT    = process.env.VITE_JAL_SHORT    || 'JAL';
const JAL_DESC     = process.env.VITE_JAL_DESC     || 'Sistema de gestión documental para JAL de Medellín';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        name: JAL_NOMBRE,
        short_name: JAL_SHORT,
        description: JAL_DESC,
        theme_color: '#193B35',
        background_color: '#F6F3EC',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Auditoría 2026-11-05 (P3-5): la precarga bajaba 2,1 MB en la primera visita,
        // incluido lo que casi nadie usa sin conexión. Fuera de la precarga (se bajan al
        // usarse y quedan en caché): la página de Reportes (Recharts, solo
        // administrador/edil y siempre con conexión) y las fuentes en alfabetos que la
        // app no usa. El bloque `docs` SÍ se precarga: lo necesita el modo sin conexión.
        globIgnores: [
          '**/ReportsPage-*.js',
          '**/*-cyrillic*.woff2',
          '**/*-greek*.woff2',
          '**/*-vietnamese*.woff2',
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-bajo-demanda',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
          {
            // Network-first para llamadas a la API
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Cache-first para plantillas .docx
            urlPattern: ({ url }) => url.pathname.startsWith('/templates'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'templates-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  optimizeDeps: {
    include: ['docx', 'pdf-lib'],
  },
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          store: ['zustand'],
          docs: ['docxtemplater', 'pizzip', 'pdf-lib', 'docx'],
        },
      },
    },
  },
});
