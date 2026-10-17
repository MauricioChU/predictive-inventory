import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// Plan 14: la versión de package.json, para "Acerca de" en Ajustes.
const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string }

/**
 * Lo que el service worker guarda para usar sin conexión (RN-UX-14 / RN-SIS-08): todo lo que
 * la app necesita, letra incluida. Afuera (RN-SIS-09, primera carga más liviana): las páginas
 * del kit de pantallas de prueba (`src/shared/ui/__catalogo__/CatalogoKit*.vue`, chunks
 * `CatalogoKit*`) y, como por defecto en workbox, node_modules. Lo demás SÍ va: las pantallas del
 * módulo Catálogo (p. ej. `CatalogoVista-*`) y el chunk de GraficoBarras (la Torre lo usa).
 * Workbox agrega solo `sw.js` y `workbox-*.js` a lo ignorado.
 */
export const PRECACHE = {
  globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
  globIgnores: ['**/node_modules/**/*', '**/CatalogoKit*'],
}

// https://vite.dev/config/
export default defineConfig({
  base: '/predictive-inventory/',
  define: { __VERSION_DE_LA_APP__: JSON.stringify(version) },
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
        ...PRECACHE,
        // Ola 3, ruling 5: tocar una notificación abre su pantalla (public/sw-notificaciones.js).
        importScripts: ['sw-notificaciones.js'],
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
