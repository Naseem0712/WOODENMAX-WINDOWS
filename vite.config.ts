import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
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