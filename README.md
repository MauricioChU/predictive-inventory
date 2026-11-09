# Inventario de la tienda

**La libreta inteligente de una tienda de barrio.** Una app para el celular que lleva el stock, dice cuánto se gana y qué conviene comprar, **funciona sin internet** y está hecha para que la use sola una persona mayor.

[![CI](https://github.com/MauricioChU/predictive-inventory/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/MauricioChU/predictive-inventory/actions/workflows/ci.yml)
![Versión](https://img.shields.io/badge/versi%C3%B3n-0.6.0-0a524c)
![Fase](https://img.shields.io/badge/fase-1%20%C2%B7%20app%20local-0a524c)

**Abrir la app:** https://mauriciochu.github.io/predictive-inventory/

---

## El problema

Una tienda de productos de limpieza lleva el stock de memoria o en cuaderno, con la mercadería desordenada y **sin códigos de barras**. Por eso:

- **se compra mercadería de más**, y el dinero queda parado en el estante;
- los productos **se acaban sin aviso**;
- **no se sabe cuánto se gana** de verdad;
- un cuaderno o un celular perdido se lleva todos los datos.

## La solución

Una app web instalable (PWA) que vive en el celular de la tienda:

| Para… | La app… |
|---|---|
| **Vender** | Busca por nombre y foto, suma el total y descuenta el stock en segundos. |
| **Recibir mercadería** | Registra lo que llegó con su costo y **avisa si estás comprando de más**. |
| **Saber qué falta** | Marca lo que está *Por acabarse* o *Agotado* y dice "Se acaba en ~4 días". |
| **Comprar bien** | Responde **"¿Necesito comprar?"** con una frase y arma la **lista para comprar** con cantidades y dinero. |
| **Saber cuánto ganas** | Muestra el **Total vendido** y la **Ganancia real** de hoy, y si ya cubriste el **alquiler del local**. |
| **No perder nada** | Nada se borra (se anula), hay copias con fotos y Excel, y la copia en la nube llega en la Fase 2. |

Todo con **letra grande**, una acción principal por pantalla, palabras de la tienda y **Deshacer** para cada error.

## Instalar en el celular

1. Abrir https://mauriciochu.github.io/predictive-inventory/ en **Chrome** (Android).
2. Tocar **Instalar app** (o menú ⋮ → *Agregar a la pantalla principal*).
3. Listo: se abre como cualquier app, **funciona sin internet** y se actualiza sola.

> Los datos viven **en el celular**. Guarda una copia desde *Ajustes → Guardar copia* de vez en cuando.

## Estado

| Fase | Qué trae | Estado |
|---|---|---|
| **1 · App local** | Todo el inventario en el celular, sin internet | ✅ Publicada (v0.6.0) y en uso real |
| **2 · Nube** | Copia automática en la nube, recuperar la tienda en otro celular, avisos con la app cerrada (también a un familiar), respaldos nocturnos | 📝 En diseño |
| **3 · Consulta a distancia** | Ver la tienda desde cualquier navegador, con inicio de sesión | 💭 Idea |

Detalle en la [hoja de ruta](docs/proyecto/03-hoja-de-ruta.md) y las novedades de cada versión en el [CHANGELOG](CHANGELOG.md).

## Documentación

| Quiero… | Leer |
|---|---|
| Entender **por qué** existe y **hacia dónde va** | [Visión, misión y principios](docs/proyecto/01-vision-y-mision.md) |
| Saber **qué entra y qué no** | [Alcance](docs/proyecto/02-alcance.md) |
| Ver **qué sigue** | [Hoja de ruta](docs/proyecto/03-hoja-de-ruta.md) |
| Conocer **cada pantalla** | [Qué hace la app hoy](docs/proyecto/04-funcionalidades.md) |
| Entender la **arquitectura** y el glosario | [Visión y arquitectura](docs/specs/00-vision-y-arquitectura.md) |
| Leer las **reglas de negocio** | [Specs](docs/specs/README.md) (Fase 1: [índice](docs/specs/fase-1/README.md)) |
| Saber **por qué se decidió** algo | [Decisiones de arquitectura (ADR)](docs/adr/README.md) |
| Diseñar una pantalla | [Patrones de diseño](docs/diseno/patrones.md) |
| **Contribuir** | [Cómo se trabaja](CONTRIBUTING.md) |

## Cómo está hecha

```
┌──────────── Celular (PWA) ────────────┐            ┌──────── Nube (Fase 2) ────────┐
│ UI · Vue 3                            │            │ FastAPI (hexagonal)           │
│ Casos de uso                          │   HTTPS    │  ├─ Sincronización            │
│ Dominio · TypeScript puro             │ ─────────► │  ├─ Avisos push               │
│ Adaptadores · IndexedDB (Dexie),      │  (Fase 2)  │  └─ Respaldos                 │
│ notificaciones, fotos, Excel          │            │ Postgres (Neon)               │
└───────────────────────────────────────┘            └───────────────────────────────┘
```

- **Local-first**: el celular nunca espera a un servidor ([ADR-0001](docs/adr/0001-local-first.md)).
- **Libro de operaciones inmutable**: el stock es la suma de operaciones que no se editan; los errores se anulan ([ADR-0002](docs/adr/0002-libro-de-operaciones-inmutable.md)).
- **Enteros para dinero y cantidades**: céntimos y milésimas, sin errores de redondeo ([ADR-0003](docs/adr/0003-enteros-para-dinero-y-cantidades.md)).
- **Arquitectura hexagonal por módulos**: catálogo, inventario, alertas, análisis, respaldo y tienda, cada uno con `domain`, `application`, `infrastructure` y `ui`; el lint impide que el dominio dependa de algo externo ([ADR-0005](docs/adr/0005-arquitectura-hexagonal-modular.md)).
- **Specs ejecutables**: cada regla de negocio (`RN-*`) tiene escenarios Gherkin en español que corren como tests ([ADR-0006](docs/adr/0006-specs-ejecutables.md)).

| Parte | Tecnologías |
|---|---|
| App | Vue 3, TypeScript, Vite, Pinia, Vue Router, `vite-plugin-pwa`, Dexie (IndexedDB), lucide, Atkinson Hyperlegible |
| Pruebas | Vitest, Vue Test Utils, `fake-indexeddb`, Gherkin, Playwright, axe-core |
| Calidad | ESLint, oxlint, Prettier, `vue-tsc` |
| Backend (Fase 2) | Python 3.12, FastAPI, Pydantic, pytest, ruff, mypy; Postgres en Neon |
| Publicación | GitHub Actions (CI) y GitHub Pages |

## Estructura

```
predictive-inventory/
├─ frontend/            App (PWA): Vue 3 + TypeScript
│  ├─ src/app/          arranque, rutas e inyección de dependencias
│  ├─ src/modules/      catalogo · inventario · alertas · analisis · respaldo · tienda
│  ├─ src/shared/       dominio común (Dinero, Cantidad, Fecha), contratos, UI base
│  ├─ tests/            aceptación (Gherkin), integración, persistencia, pantallas, build
│  └─ e2e/              Playwright
├─ backend/             FastAPI (esqueleto; se construye en la Fase 2)
├─ docs/
│  ├─ proyecto/         visión, alcance, hoja de ruta y funcionalidades
│  ├─ specs/            especificaciones y reglas de negocio
│  ├─ adr/              decisiones de arquitectura
│  ├─ plans/            planes de implementación
│  └─ diseno/           patrones de diseño
└─ .github/workflows/   CI y publicación
```

## Desarrollo

**Requisitos:** Node 24 (o 22.18+) y, para el backend, Python 3.12+.

### App

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173/predictive-inventory/
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (agregar `-- --host` para abrirlo desde el celular en la misma red) |
| `npm run lint` | oxlint + ESLint |
| `npm run type-check` | Tipos con `vue-tsc` |
| `npm run test:unit` | Vitest en modo observación |
| `npm run test:cobertura` | Vitest con cobertura |
| `npm run test:e2e` | Playwright (en local, solo lo tocado: `npx playwright test e2e/<archivo> --workers=1`) |
| `npm run verificar-specs` | Cada regla tiene su escenario |
| `npm run build` | Tipos + build de producción en `dist/` |

### Backend

Ver [backend/README.md](backend/README.md).

## Integración continua y publicación

- Cada push y pull request a `develop` y `main` corre **4 checks**: Frontend, Specs, E2E y Backend.
- `main` y `develop` están protegidas: solo se integra por pull request con el CI en verde.
- Cada cambio en `main` se publica solo en **GitHub Pages**, y los celulares se actualizan solos.
- Versiones con SemVer y un PR de entrega `release: vX.Y.Z` ([ADR-0010](docs/adr/0010-versiones-y-publicacion.md)).

Activación de Pages (una sola vez): *Settings → Pages → Build and deployment → Source: **GitHub Actions***.
