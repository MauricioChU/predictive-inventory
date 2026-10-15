# Inventario — Tienda de productos de limpieza

Sistema de inventario *local-first*: app móvil (PWA) que funciona sin internet y se sincroniza con la nube.

- `frontend/` — Vue 3 + TypeScript (PWA)
- `backend/` — FastAPI (arquitectura hexagonal + DDD)
- `docs/specs/` — especificaciones (SDD) y reglas de negocio

## Flujo de ramas

- `main` — versión estable
- `develop` — integración
- `feat/*`, `docs/*` — ramas de trabajo que salen de `develop` y vuelven a ella
