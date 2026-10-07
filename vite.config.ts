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
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'screenshots/*.png'],
      manifest: {
        /** identidad estable de la app instalada */
        id: '/gastos-compartidos/',
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
        /** capturas que Chrome muestra en el diálogo de instalación */
        screenshots: [
          {
            src: 'screenshots/escritorio.png',
            sizes: '1280x800',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Resumen del mes con el porcentaje de aporte y el fondo común',
          },
          {
            src: 'screenshots/movil.png',
            sizes: '390x844',
            type: 'image/png',
            label: 'Vista en el móvil',
          },
        ],
        /** atajos al mantener pulsado el icono de la app instalada */
        shortcuts: [
          {
            name: 'Mes en curso',
            short_name: 'Mes',
            url: './#mes',
            icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Catálogo de gastos',
            short_name: 'Gastos',
            url: './#gastos',
            icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Metas de ahorro',
            short_name: 'Metas',
            url: './#metas',
            icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // las capturas solo las usa el diálogo de instalación del navegador:
        // no tienen por qué ocupar el precaché que se descarga el usuario
        globIgnores: ['**/screenshots/**'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
})
