# Frontend · App (PWA)

Vue 3 + TypeScript + Vite. Funciona completa sin internet: los datos viven en IndexedDB (Dexie). Qué es el proyecto: [README principal](../README.md).

## Requisitos

Node 24 (o 22.18+).

## Comandos

```bash
npm install
npm run dev                # http://localhost:5173/predictive-inventory/  (-- --host para verlo desde el celular)
npm run lint               # oxlint + ESLint
npm run type-check         # vue-tsc
npm run test:unit          # Vitest en modo observación
npm run test:cobertura     # Vitest con cobertura (dominio 95 %, aplicación 90 %)
npm run verificar-specs    # cada RN-* tiene su escenario Gherkin
npm run test:e2e           # Playwright (en local: un archivo y --workers=1)
npm run build              # tipos + build de producción en dist/
```

> `e2e/` no pasa por Prettier: no correr `prettier --write` sobre esa carpeta.

## Organización

```
src/
├─ app/            arranque, router e inyección de dependencias (provide / inject)
├─ modules/
│  ├─ catalogo/    productos, categorías, fotos
│  ├─ inventario/  operaciones (venta, ingreso, merma, ajuste, anulación) y stock
│  ├─ alertas/     estados de stock, avisos y notificaciones
│  ├─ analisis/    Control, Ayuda inteligente, predicción, lista para comprar
│  ├─ respaldo/    copias, Excel e importación
│  └─ tienda/      configuración del negocio
└─ shared/         dominio común (Dinero, Cantidad, Fecha), contratos entre módulos, UI base y estilos
```

Cada módulo tiene cuatro capas y las dependencias apuntan hacia adentro:

```
ui  ──►  application  ──►  domain  ◄──  infrastructure
```

El **dominio** es TypeScript puro: no importa Vue, Pinia, Dexie ni APIs del navegador. ESLint (`no-restricted-imports`) falla si alguien lo rompe ([ADR-0005](../docs/adr/0005-arquitectura-hexagonal-modular.md)).

## Pruebas

| Carpeta | Qué hay |
|---|---|
| `src/**/*.spec.ts` | Dominio, aplicación, infraestructura y componentes (Vitest) |
| `tests/aceptacion`, `tests/gherkin` | Escenarios Gherkin de [docs/specs](../docs/specs/README.md) ejecutados contra los casos de uso |
| `tests/persistencia`, `tests/integracion` | Dexie con `fake-indexeddb` y módulos juntos |
| `tests/pantallas`, `tests/service-worker`, `tests/build` | Pantallas, modo sin conexión y el build publicado |
| `e2e/` | Playwright en 360 × 740 y 1280 × 800, con axe-core |

## Diseño

Antes de crear un estilo, buscar el patrón en [docs/diseno/patrones.md](../docs/diseno/patrones.md). Los tokens (colores, espacios, letra, animaciones) están en `src/shared/ui/estilos/tokens.css`.
