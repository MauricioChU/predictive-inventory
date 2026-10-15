# 07 · Calidad, pruebas y flujo de trabajo

Objetivo: que **cada regla de negocio esté probada** y que **ningún merge rompa nada**.

## Pirámide de pruebas

| Nivel | Qué prueba | Herramienta | Dónde |
|---|---|---|---|
| **Dominio** | Reglas puras: Dinero, Cantidad, Producto, Operación, estados, VPD, sugeridos, rankings | Vitest | `src/modules/*/domain/**/*.spec.ts` |
| **Aceptación** | Escenarios Gherkin de cada `RN-*`, ejecutados contra los **casos de uso** con repositorios en memoria | Vitest + runner Gherkin | `docs/specs/fase-1/features/*.feature` |
| **Infraestructura** | Adaptadores Dexie (transacciones, índices, reconstrucción), Excel, respaldo | Vitest + `fake-indexeddb` | `src/modules/*/infrastructure/**/*.spec.ts` |
| **Componentes** | Componentes de UI clave: carrito, teclado numérico, tarjetas de estado | Vitest + Vue Test Utils | `src/**/ui/**/*.spec.ts` |
| **E2E** | Flujos completos en navegador real, en tamaños de celular y PC | Playwright | `frontend/e2e/` |
| **Accesibilidad** | Sin violaciones graves o críticas en cada pantalla | Playwright + axe-core | `frontend/e2e/` |

## Reglas de calidad

| Id | Regla |
|---|---|
| **RN-SIS-01** | Cada regla de negocio (`RN-CAT`, `RN-OP`, `RN-AL`, `RN-AN`, `RN-RE`) tiene al menos un escenario Gherkin con su etiqueta, y ese escenario pasa. Un script de verificación falla si alguna regla de la spec no tiene escenario o si un escenario cita una regla que no existe. Las reglas `RN-UX` y `RN-SIS` se verifican con pruebas E2E, de componentes y en el CI. |
| **RN-SIS-02** | Cobertura mínima: **dominio 95 %**, **aplicación 90 %** (líneas y ramas). |
| **RN-SIS-03** | TypeScript estricto, sin `any` explícito. ESLint y Prettier sin errores. |
| **RN-SIS-04** | El **dominio no importa** Vue, Pinia, Dexie ni nada de `infrastructure` o `ui` (ESLint `no-restricted-imports`, ver [ADR-0005](../../adr/0005-arquitectura-hexagonal-modular.md)). |
| **RN-SIS-05** | **E2E** de los flujos críticos (primera vez, crear producto, vender con vuelto, deshacer, recibir mercadería, contar stock, lista para comprar → registrar llegada, guardar y restaurar copia) en **360 × 740** (Android) y **1280 × 800** (PC). |
| **RN-SIS-06** | **Responsive** automatizado: en cada pantalla, a **320, 360, 768 y 1280 px** y con letra *Muy grande*, `scrollWidth ≤ clientWidth` (sin desplazamiento horizontal) y ningún botón principal queda fuera de la vista. |
| **RN-SIS-07** | **Accesibilidad**: axe-core sin violaciones `serious` ni `critical` en cada pantalla. |
| **RN-SIS-08** | **Offline**: una prueba E2E abre la app, pasa a modo sin conexión, recarga y completa una venta. |
| **RN-SIS-09** | **Rendimiento** con datos realistas (300 productos, 50 000 movimientos): la Torre de control carga en menos de 1 s y una venta se confirma en menos de 300 ms en un perfil de celular de gama media. |

## Datos de ejemplo compartidos

Los cálculos de análisis se prueban con **vectores de prueba** en JSON (`docs/specs/fase-1/fixtures/`): entradas (productos, operaciones, fecha de hoy) y resultados esperados (VPD, cobertura, sugerido, rankings). En la Fase 2 el backend corre **los mismos archivos** con pytest, para que frontend y backend calculen igual ([ADR-0006](../../adr/0006-specs-ejecutables.md)).

## Flujo de ramas

```
main ───────────────●──────────────────────●── (versiones: v0.1.0, …)
                    │                      ▲
develop ──●────●────●────●────●────●───────┘
           \  /      \  /      \  /
       feat/catalogo  feat/ventas  feat/torre-de-control …
```

- `main`: solo versiones estables, con etiqueta (`v0.1.0` al cerrar la Fase 1).
- `develop`: integración; siempre en verde.
- `feat/*`, `docs/*`, `fix/*`, `chore/*`: salen de `develop` y vuelven a `develop`.
- Ramas que no dependen entre sí se trabajan **en paralelo** (worktrees).
- Commits con [Conventional Commits](https://www.conventionalcommits.org/es/) en español: `feat(inventario): registrar venta con varias líneas`.

## Definition of Done (por rama)

Una rama entra a `develop` solo si:

1. Sus escenarios Gherkin y tests están en verde, y los de **todo el proyecto** también.
2. Lint, formato, `type-check` y `build` pasan.
3. E2E y pruebas responsive/accesibilidad de las pantallas tocadas pasan.
4. La spec y el código dicen lo mismo (si cambió una regla, primero cambió la spec).
5. Se actualizó `develop` dentro de la rama antes de integrar (sin conflictos pendientes).
6. El merge es `--no-ff` y, después del merge, **se vuelve a correr todo en `develop`**.

## Integración continua (GitHub Actions)

En cada push y pull request a `develop` y `main`:

| Trabajo | Pasos |
|---|---|
| `frontend` | `npm ci` → lint → type-check → tests con cobertura → build |
| `e2e` | build → Playwright (celular y PC) con axe y verificación responsive |
| `specs` | verificación de que cada `RN-*` tiene escenario (RN-SIS-01) |
| `backend` | `pip install` → ruff → mypy → pytest |

Recomendación para el repositorio en GitHub: **proteger `main` y `develop`** para exigir que el CI pase antes de integrar.
