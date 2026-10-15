# ADR-0007 · Frontend publicado en GitHub Pages

**Estado:** Aceptado · 2026-10-15

## Contexto

La PWA debe servirse por HTTPS para poder instalarse en Android. El hosting solo entrega los archivos de la app (y sus actualizaciones): los **datos no viven ahí**, sino en el celular. Si el hosting dejara de existir, la app instalada seguiría funcionando sin internet; solo dejarían de llegar actualizaciones.

Requisito del proyecto: **costo cero** y sin crear cuentas nuevas si es posible.

Opciones evaluadas (todas gratuitas):

| Opción | A favor | En contra |
|---|---|---|
| **GitHub Pages** | Usa la cuenta de GitHub que ya existe; se publica desde el mismo repositorio con GitHub Actions. | El origen `mauriciochu.github.io` es compartido por los sitios de la cuenta; necesita ruta base `/predictive-inventory/`. |
| Cloudflare Pages / Netlify | Origen propio, vistas previas por rama. | Requiere crear otra cuenta. |
| APK con Capacitor | No requiere hosting; notificaciones con la app cerrada desde la Fase 1. | Actualizaciones manuales (instalar el APK nuevo). Descartado por preferencia del dueño del producto. |

## Decisión

- Publicar el frontend en **GitHub Pages** con un workflow de GitHub Actions que construye y despliega cada vez que se actualiza `main`.
- Vite usa `base: '/predictive-inventory/'`; el router usa esa misma base y se publica una copia de `index.html` como `404.html` para que los enlaces directos funcionen.
- El Service Worker queda limitado a la ruta `/predictive-inventory/` y la base de datos local se llama `predictive-inventory`, para no chocar con otros sitios del mismo origen.
- Activación (una sola vez, por el dueño del repositorio): *Settings → Pages → Source: GitHub Actions*.

## Consecuencias

- ✅ Costo cero, sin cuentas nuevas y con actualizaciones automáticas para el usuario.
- ✅ El repositorio es público, condición del plan gratuito de GitHub Pages.
- ⚠️ El origen es la identidad de los datos locales: **no se debe cambiar** de dominio a la ligera. Si algún día se usa un dominio propio, los datos se pasan con *Guardar copia* → *Restaurar copia* (o se bajan de la nube desde la Fase 2).
- ⚠️ Las notificaciones con la app cerrada siguen esperando a la Fase 2 (push desde el servidor).
