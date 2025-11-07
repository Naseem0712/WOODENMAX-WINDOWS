import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'WoodenMax Window Designer',
        short_name: 'WoodenMax',
        description: 'Design custom windows, doors, and more with the WoodenMax Window Designer. Generate instant quotes and material lists.',
        theme_color: '#1e293b',
        background_color: '#0f172a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxOTIiIGhlaWdodD0iMTkyIiB2aWV3Qm94PSIwIDAgNDAgNDAiPjxyZWN0IHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcng9IjgiIGZpbGw9IiM0MzM4Q0EiLz48cGF0aCBkPSJNOCAxMkwxNCAyOEwyMCAxNkwyNiAyOEwzMiAxMiIgc3Ryb2tlPSIjRDZBMTE4IiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNDAgNDAiPjxyZWN0IHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcng9IjgiIGZpbGw9IiM0MzM4Q0EiLz48cGF0aCBkPSJNOCAxMkwxNCAyOEwyMCAxNkwyNiAyOEwzMiAxMiIgc3Ryb2tlPSIjRDZBMTE4IiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==',
            sizes: '512x512',
            type: 'image/svg+xml'
          },
          {
            src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNDAgNDAiPjxyZWN0IHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcng9IjgiIGZpbGw9IiM0MzM4Q0EiLz48cGF0aCBkPSJNOCAxMkwxNCAyOEwyMCAxNkwyNiAyOEwzMiAxMiIgc3Ryb2tlPSIjRDZBMTE4IiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})