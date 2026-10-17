# ADR-0008 · Postgres en Neon (Fase 2)

**Estado:** Aceptado · 2026-10-15

## Contexto

La nube debe guardar productos, operaciones y suscripciones sin costo. Se evaluaron MongoDB Atlas (plan gratis M0) y Postgres gestionado.

## Decisión

**Postgres** en **Neon** (plan gratis), accedido desde FastAPI con SQLAlchemy 2 y migraciones con Alembic.

## Razones

1. El inventario es **relacional**: producto → categoría, movimiento → operación → producto.
2. Las reglas se apoyan en la base: transacciones ACID, `UNIQUE` (nombre, código, id de operación para idempotencia) y `CHECK`.
3. El stock y los reportes son `SUM … GROUP BY`.
4. Neon no pausa los proyectos inactivos como hace el plan gratis de Supabase.

## Consecuencias

- ✅ Integridad garantizada por la base, no solo por el código.
- ⚠️ El plan gratis "duerme" la base cuando no se usa y el primer acceso tarda un poco. No afecta al usuario porque la app es local-first ([ADR-0001](0001-local-first.md)).
- Respaldos: copia nocturna con `pg_dump` desde GitHub Actions a Cloudflare R2, con 30 días de retención y prueba periódica de restauración.
