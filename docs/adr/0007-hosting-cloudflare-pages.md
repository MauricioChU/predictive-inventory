# ADR-0007 · Frontend en Cloudflare Pages

**Estado:** Propuesto · 2026-10-15 (requiere que el dueño del proyecto cree la cuenta)

## Contexto

La PWA debe servirse por HTTPS para poder instalarse. Los datos locales (IndexedDB) quedan ligados al **origen**: si la app cambia de dominio, el celular no ve los datos anteriores. Conviene elegir el origen definitivo desde el inicio.

Opciones gratuitas evaluadas:

- **GitHub Pages**: no requiere otra cuenta, pero el origen `mauriciochu.github.io` es **compartido** por todos los proyectos de la cuenta y necesita una ruta base (`/predictive-inventory/`).
- **Netlify / Vercel**: origen propio y buen plan gratis.
- **Cloudflare Pages**: origen propio (`predictive-inventory.pages.dev`), ancho de banda sin límite en el plan gratis, **vistas previas automáticas por rama** y conexión directa con el repositorio de GitHub.

## Decisión

Publicar el frontend en **Cloudflare Pages**: la rama `main` es producción y `develop` y las ramas `feat/*` tienen vistas previas.

## Consecuencias

- ✅ Origen propio y estable; vistas previas para probar en el celular antes de integrar.
- ⚠️ Requiere crear una cuenta de Cloudflare y conectar el repositorio (una sola vez).
- ⚠️ Mientras no exista la nube (Fase 2), un cambio de dominio obligaría a usar *Guardar copia* y *Restaurar copia*.
