import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    target: 'es2020',
    cssMinify: true,
    /** Smaller JS; avoid shipping license banners in every chunk. */
    esbuild: {
      legalComments: 'none',
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-router')
          ) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/uuid')) {
            return 'vendor-utils';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    // Dev: warm common entry files so first navigation is snappier after server start.
    warmup: { clientFiles: ['./src/index.tsx', './src/App.tsx'] },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Service worker in dev expects generated files under dev-dist/; leave off to avoid ENOENT on sw.js
      devOptions: {
        enabled: false,
        navigateFallbackAllowlist: [/^\/.*/],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/sitemap\.xml$/, /^\/robots\.txt$/, /^\/llms\.txt$/],
        navigateFallbackAllowlist: [/^\/.*/],
        disableDevLogs: true,
      },
      includeAssets: ['favicon.png', 'logo.jpg'],
      manifest: {
        name: 'WoodenMax Window Designer',
        short_name: 'WoodenMax',
        description: 'Design aluminium & uPVC windows, doors, partitions & more. Instant quotes, PDF & BOM — WoodenMax Window Designer.',
        theme_color: '#1e293b',
        background_color: '#0f172a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'favicon.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'favicon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'favicon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      }
    })
  ],
})