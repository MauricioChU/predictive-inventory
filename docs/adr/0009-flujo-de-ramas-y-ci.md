# ADR-0009 · Flujo de ramas y CI

**Estado:** Aceptado · 2026-10-15

## Contexto

Se quiere trabajar ordenado, en paralelo y sin que un merge rompa lo que ya funciona.

## Decisión

- Ramas: `main` (versiones estables con etiqueta), `develop` (integración, siempre en verde) y ramas de trabajo `feat/*`, `fix/*`, `docs/*` y `chore/*`, que salen de `develop` y vuelven a ella.
- Las ramas independientes se desarrollan **en paralelo** con `git worktree`.
- Antes de integrar: se actualiza la rama con `develop`, se corre la verificación completa y se integra con `merge --no-ff`. Después del merge se vuelve a verificar `develop`.
- **GitHub Actions** corre lint, tipos, tests, build, E2E y la verificación de specs en cada push y pull request a `develop` y `main`.
- Commits con Conventional Commits en español.

## Consecuencias

- ✅ `develop` siempre funciona y el historial muestra de qué rama vino cada cambio.
- ⚠️ Se recomienda activar la **protección de ramas** en GitHub para `main` y `develop` (lo hace el dueño del repositorio).
