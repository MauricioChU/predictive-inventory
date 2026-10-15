# ADR-0001 · Local-first con PWA e IndexedDB

**Estado:** Aceptado · 2026-10-15

## Contexto

El usuario principal usa un celular Android, la tienda puede quedarse sin internet y no hay presupuesto para un servidor propio. FastAPI no puede ejecutarse dentro del celular.

## Decisión

- El frontend es una **PWA** (Vue 3 + `vite-plugin-pwa`) que se instala en Android y funciona completa sin conexión.
- Los datos viven en **IndexedDB** a través de **Dexie**, con transacciones para mantener la consistencia.
- En la Fase 2, un backend FastAPI con Postgres recibe los cambios en segundo plano. La app **nunca espera** al servidor para responder.
- Se pide **almacenamiento persistente** (`navigator.storage.persist()`) y hay respaldo manual mientras no exista la nube.

## Consecuencias

- ✅ Respuesta instantánea y funcionamiento en modo avión.
- ✅ Un backend gratuito que "se duerme" no afecta al usuario.
- ⚠️ Las reglas que protegen el stock deben ejecutarse en el celular (dominio en TypeScript) y, en la Fase 2, también en el servidor. Se mitiga con specs ejecutables compartidas ([ADR-0006](0006-specs-ejecutables.md)).
- ⚠️ Los datos de IndexedDB pertenecen al **origen** (dominio) del sitio: cambiar de dominio deja los datos atrás. Ver [ADR-0007](0007-hosting-cloudflare-pages.md).
