import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/predictive-inventory/',
  plugins: [
    vue(),
    // vite-plugin-vue-devtools queda fuera: su panel flotante inyecta un atributo
    // ARIA no permitido (aria-prohibited-attr) que hace fallar el chequeo de
    // accesibilidad de Playwright (RN-SIS-07) al correr contra `npm run dev`.
    VitePWA({
      // La app se actualiza sola: el usuario no debe responder avisos técnicos
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      workbox: {
        navigateFallback: 'index.html',
      },
      manifest: {
        id: '/predictive-inventory/',
        name: 'Inventario de la Tienda',
        short_name: 'Inventario',
        description: 'Control de stock de productos de limpieza',
        lang: 'es',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0f766e',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
