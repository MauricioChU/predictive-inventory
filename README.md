# Inventario — Tienda de productos de limpieza

Sistema de inventario *local-first*: app móvil (PWA) que funciona sin internet y se sincroniza con la nube.

- `frontend/` — Vue 3 + TypeScript (PWA)
- `backend/` — FastAPI (arquitectura hexagonal + DDD)
- `docs/specs/` — especificaciones (SDD) y reglas de negocio

## Flujo de ramas

- `main` — versión estable
- `develop` — integración
- `feat/*`, `docs/*` — ramas de trabajo que salen de `develop` y vuelven a ella

## Publicación

La app se publica gratis en GitHub Pages cada vez que se actualiza `main`:
**https://mauriciochu.github.io/predictive-inventory/**

Activación (una sola vez): en GitHub, *Settings → Pages → Build and deployment → Source: **GitHub Actions***.

Para instalarla en el celular: abrir el enlace en Chrome (Android) y tocar **Instalar app** (o menú ⋮ → *Agregar a la pantalla principal*). Después funciona sin internet.

## Integración continua

Cada push y pull request a `develop` y `main` corre lint, tipos, tests con cobertura, verificación de specs, E2E (celular y PC) y los checks del backend. Recomendado: proteger `develop` y `main` para exigir que el CI pase (*Settings → Branches*).
