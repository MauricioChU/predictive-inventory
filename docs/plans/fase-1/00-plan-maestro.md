# Fase 1 — Plan maestro de implementación

> **Para agentes:** cada ola se ejecuta con `superpowers:subagent-driven-development`: un subagente implementador por rama, luego revisión de cumplimiento de spec y de calidad, y recién entonces merge. Los pasos usan casillas (`- [ ]`).

**Objetivo:** construir la app local-first de la Fase 1 descrita en [docs/specs/fase-1/](../../specs/fase-1/README.md).

**Arquitectura:** PWA Vue 3 + TypeScript. Módulos hexagonales (`catalogo`, `inventario`, `analisis`, `alertas`, `respaldo`, `tienda`) con dominio puro, casos de uso y adaptadores (en memoria para pruebas, Dexie para la app). Las specs Gherkin se ejecutan como tests contra los casos de uso.

**Stack:** Vue 3.5, Vite 8, TypeScript 6, Pinia 4, Vue Router 5, Vitest 4, Playwright, Dexie 4, `@cucumber/gherkin` + `@cucumber/cucumber-expressions`, `vite-plugin-pwa`, `lucide-vue-next`, `write-excel-file` / `read-excel-file`.

**Spec:** `docs/specs/` (visión, Fase 1, features) y `docs/adr/`.

## Restricciones globales (aplican a todas las tareas)

- Dinero en **céntimos** (`Dinero`), cantidades en **milésimas** (`Cantidad`); nunca `number` con decimales para montos o cantidades (ADR-0003).
- Redondeo de `Dinero × Cantidad`: al céntimo, **mitad alejándose de cero**, por línea.
- Día de negocio: zona `America/Lima` (UTC−5 fijo, sin horario de verano). Usar siempre `shared/domain/fecha.ts`.
- El dominio (`modules/*/domain`, `shared/domain`) es TypeScript puro: sin Vue, Pinia, Dexie ni APIs del navegador (ADR-0005; lo verifica ESLint).
- Otros módulos se importan **solo** por su `index.ts` (`@/modules/<modulo>`). Dentro de un módulo, rutas relativas.
- Los mensajes al usuario son **exactamente** los de la spec y los `.feature` (tono "tú", lenguaje simple, singular y plural correctos).
- TypeScript estricto, sin `any` explícito. Tests colocados junto al código: `*.spec.ts`. El nombre de cada test empieza por la regla: `it('RN-OP-05: rechaza una venta mayor al stock', …)`.
- Base pública de la app: `/predictive-inventory/` (ADR-0007). Base de datos local: `predictive-inventory`.
- Commits con Conventional Commits en español, terminando con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **No se modifica la spec** desde una rama `feat/*`. Si una regla parece contradictoria, se reporta.

## Olas y ramas

```
Ola 1 (paralelo) ─┬─ feat/fundamentos      (A) dominio compartido, contratos, runner Gherkin, verificación de specs
                  ├─ feat/ui-base          (B) diseño, componentes base, navegación, Playwright
                  └─ chore/ci-despliegue   (C) GitHub Actions: CI y publicación en GitHub Pages
                         │ merge A, B, C → develop
Ola 2 (paralelo) ─┬─ feat/catalogo         (D) RN-CAT
                  ├─ feat/inventario       (E) RN-OP
                  ├─ feat/analisis         (F) RN-AN
                  ├─ feat/alertas          (G) RN-AL
                  └─ feat/respaldo-tienda  (H) RN-RE + configuración de la tienda
                         │ merge → develop
Ola 3 ── feat/composicion-dexie (I) composición, adaptadores Dexie, mundo de pruebas
                         │ merge → develop
Ola 4 (paralelo) ─┬─ feat/aceptacion       (J) definiciones de pasos Gherkin de las 5 features
                  ├─ feat/ui-productos     (K) productos, categorías, fotos
                  ├─ feat/ui-operaciones   (L) vender, recibir, merma, contar, conteo guiado, historial
                  ├─ feat/ui-control       (M) torre de control, para comprar, ¿necesito comprar?
                  └─ feat/ui-inicio-ajustes (N) inicio, primera vez, ajustes, respaldo, importación, avisos
                         │ merge → develop
Ola 5 ── feat/e2e-calidad (O) E2E de flujos, responsive, accesibilidad, offline, rendimiento
                         │ develop → main, etiqueta v0.1.0, publicación
```

| Plan | Rama | Depende de |
|---|---|---|
| [01-fundamentos.md](01-fundamentos.md) | `feat/fundamentos` | — |
| [02-ui-base.md](02-ui-base.md) | `feat/ui-base` | — |
| [03-ci-despliegue.md](03-ci-despliegue.md) | `chore/ci-despliegue` | — |
| 04–08 (Ola 2) | ver tabla | A |
| 09 (Ola 3) | `feat/composicion-dexie` | Ola 2 |
| 10–14 (Ola 4) | ver tabla | I, B |
| 15 (Ola 5) | `feat/e2e-calidad` | Ola 4 |

Los planes de las olas 2 a 5 se escriben cuando termina la ola anterior, sobre el código real de los contratos.

## Escenarios Gherkin pendientes

El runner marca como **pendiente** (`skip`) un escenario con algún paso sin definir, y **falla** si un paso definido falla. Durante las olas 2 a 4 puede haber pendientes. Con `GHERKIN_ESTRICTO=1` los pendientes fallan: es obligatorio al cerrar la Ola 4 y en el CI de `main`.

## Procedimiento de merge (cada rama)

1. En la rama: `git merge develop` y resolver conflictos (en `package-lock.json`: aceptar `develop` y correr `npm install`).
2. En `frontend/`: `npm run lint:ci && npm run type-check && npm run test:unit -- --run && npm run build-only && npm run verificar-specs`.
3. Revisión de spec y de calidad (subagentes revisores) aprobada.
4. `git switch develop && git merge --no-ff <rama>` y repetir el paso 2 en `develop`.
5. `git push origin develop <rama>`.
