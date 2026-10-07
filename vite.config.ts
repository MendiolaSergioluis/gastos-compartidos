import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // rutas relativas: la app funciona igual servida en un subdirectorio
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gastos Compartidos · reparto equitativo',
        short_name: 'Gastos',
        description:
          'Cada persona aporta el mismo % de su sueldo a un fondo común. Para parejas, familias y compañeros de piso.',
        lang: 'es',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        theme_color: '#0b0d17',
        background_color: '#0b0d17',
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
})
