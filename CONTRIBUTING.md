# Cómo se trabaja en este proyecto

Guía para quien vaya a cambiar algo: desde una regla de negocio hasta un color. Las reglas completas están en [07-calidad](docs/specs/fase-1/07-calidad.md), [ADR-0009](docs/adr/0009-flujo-de-ramas-y-ci.md) y [ADR-0010](docs/adr/0010-versiones-y-publicacion.md).

## 1. Primero la spec, después el código

El proyecto sigue **Spec-Driven Development**: ninguna funcionalidad se programa sin una spec aprobada ([docs/specs](docs/specs/README.md)).

1. **Spec**: historias de usuario, reglas de negocio numeradas (`RN-<MÓDULO>-<NN>`) y escenarios Gherkin en español.
2. **Revisión**: el dueño del producto aprueba la spec o pide cambios.
3. **Plan**: tareas pequeñas y ordenadas en [docs/plans](docs/plans/).
4. **Tests primero**: los archivos `.feature` se ejecutan como tests y se escriben en rojo antes del código.
5. **Código**: hasta que todo esté en verde.

Reglas que no se negocian:

- Cambiar una regla es cambiar **primero la spec**, en su propia rama `docs/*`.
- Una regla **nunca se renumera**. Si se elimina, queda tachada como *Retirada*, con fecha y motivo.
- Cada regla vigente tiene al menos un escenario con su etiqueta (`@RN-OP-05`). El CI lo verifica (`npm run verificar-specs`).
- Una decisión de arquitectura nueva se registra como **ADR** en [docs/adr](docs/adr/README.md). Un ADR aceptado no se edita: se reemplaza por otro.

## 2. Ramas

```
main      ── versiones publicadas (v0.6.0, …) ── se publica en GitHub Pages
develop   ── integración, siempre en verde
feat/*  fix/*  docs/*  chore/*  release/*   ── salen de develop y vuelven a develop
```

- `main` y `develop` están **protegidas**: solo se integra por pull request con el CI en verde.
- Las ramas que no dependen entre sí se trabajan en paralelo, cada una en su worktree (`.worktrees/`).
- Lo que comparten varias ramas (rutas, componentes base, reglas del lint) se arregla **una vez** en `develop` con un PR chico, no en cada rama.

## 3. Commits

[Conventional Commits](https://www.conventionalcommits.org/es/) **en español**, con el módulo como alcance:

```
feat(inventario): registrar venta con varias líneas
fix(inicio): el carrusel no se corta con letra Muy grande
docs(specs): RN-AN-19 con el caso de pago el día 31
```

## 4. Definition of Done

Una rama entra a `develop` solo si:

1. Sus escenarios Gherkin y tests pasan, y los de todo el proyecto también.
2. Lint, formato, tipos y build pasan.
3. Las pruebas E2E, responsive y de accesibilidad de las pantallas tocadas pasan.
4. La spec y el código dicen lo mismo.
5. Tiene `develop` actualizado y sin conflictos.
6. Si cambia algo visible para la tienda, agrega una línea en **"Sin publicar"** del [CHANGELOG](CHANGELOG.md), en palabras de la tienda.

## 5. Pruebas

| Nivel | Qué prueba | Herramienta |
|---|---|---|
| Dominio | Reglas puras (dinero, cantidades, estados, predicción) | Vitest |
| Aceptación | Escenarios Gherkin de cada `RN-*` contra los casos de uso | Vitest + Gherkin |
| Infraestructura | Dexie, Excel, respaldo | Vitest + `fake-indexeddb` |
| Componentes | Panel de venta, teclado numérico, tarjetas | Vitest + Vue Test Utils |
| E2E | Flujos completos en 360 × 740 (Android) y 1280 × 800 (PC) | Playwright |
| Accesibilidad | Sin violaciones graves en ninguna pantalla | Playwright + axe-core |

Metas: cobertura de **dominio 95 %** y de **aplicación 90 %**, TypeScript estricto sin `any`, sin desplazamiento horizontal de 320 a 1920 px ni con letra *Muy grande*.

En la PC de desarrollo basta con lint, tipos, Vitest y **solo los E2E de lo tocado** (`--workers=1`). La suite E2E completa la corre el CI en cada PR.

## 6. Diseño

- Antes de inventar un estilo, buscar el patrón en [docs/diseno/patrones.md](docs/diseno/patrones.md).
- Los cambios visuales se comprueban con **capturas de Playwright** en 360 × 740 con letra Grande y en 320 px con letra Muy grande, antes de entregar.
- Textos con las palabras de la tienda: ver la guía de palabras en [06-experiencia-de-uso](docs/specs/fase-1/06-experiencia-de-uso.md).

## 7. Integración continua

Cada push y pull request a `develop` y `main` corre 4 checks obligatorios:

| Check | Qué hace |
|---|---|
| **Frontend** | Lint, tipos, tests con cobertura, aceptación sobre Dexie y build |
| **Specs** | Cada regla tiene escenario y cada escenario cita una regla que existe |
| **E2E** | Playwright en celular y PC, con accesibilidad |
| **Backend** | ruff, mypy y pytest |

Un error sin manejar falla el CI **aunque los tests pasen**: hay que revisar el código de salida, no solo el resumen.

## 8. Versiones y publicación

- **SemVer**: PATCH para arreglos y cambios solo visuales; MINOR para una regla, pantalla o función nueva; MAJOR si rompe la compatibilidad (una copia que ya no se abre).
- Para publicar: rama `release/vX.Y.Z` con un solo commit `release: vX.Y.Z` (sube la versión y fecha el CHANGELOG) → PR a `develop` → PR de `develop` a `main` → etiqueta `vX.Y.Z` y GitHub Release.
- Al llegar a `main`, la app se publica sola en GitHub Pages y los celulares se actualizan solos.

## 9. Correr el proyecto

Ver la sección **Desarrollo** del [README](README.md#desarrollo).
