# Visión y arquitectura

## 1. Problema

Una tienda de productos de limpieza lleva el stock de memoria o en cuaderno, con la mercadería desordenada y **sin códigos de barras**. Los productos se acaban sin aviso, **se compra mercadería de más** por no saber cuánto hay, y no se sabe cuánto se gana al día ni qué conviene reponer. La persona que atiende es mayor, usa principalmente un **celular Android** y tiene poca experiencia con aplicaciones.

## 2. Objetivo

Una aplicación que:

1. Registre ventas y llegadas de mercadería en segundos, **con o sin internet**.
2. Avise **antes** de que un producto se acabe.
3. Muestre cuánto se ganó y **qué conviene comprar y qué no**, con datos reales de la tienda, para dejar de comprar de más.
4. Sea tan simple que se use sin ayuda después de una primera explicación.
5. Nunca pierda datos.

## 3. Usuarios

| Usuario | Dispositivo | Qué necesita |
|---|---|---|
| **Usuario principal**: la persona mayor que atiende la tienda | Celular Android (app instalada) | Vender, recibir mercadería, saber qué falta. Letra grande, pocos pasos, nada técnico. |
| **Administrador**: familiar que apoya | Celular o PC | Configurar, cargar productos, revisar ganancias y tendencias, hacer respaldos. En Fase 3: consultar a distancia. |

## 4. Principios

1. **Funciona sin internet, siempre.** La app nunca espera a un servidor para responder.
2. **Simple antes que completo.** Una acción principal por pantalla; lo avanzado, en la Torre de control.
3. **Nunca perder datos.** Almacenamiento persistente, respaldos y, desde la Fase 2, copia en la nube.
4. **Los números cuadran.** Dinero y cantidades en enteros; el stock es la suma de un libro de operaciones que no se edita.
5. **Lenguaje de la tienda.** "Llegó mercadería", no "registrar ingreso"; "Se acaba en ~4 días", no "cobertura".

## 5. Fases

| Fase | Entrega | Incluye |
|---|---|---|
| **1. App local** | PWA instalable en Android, 100 % offline | Catálogo, ventas con panel de venta, llegada de mercadería, mermas, conteos, anulaciones, alertas en la app y notificaciones del sistema con la app abierta, Torre de control completa, consulta "¿Necesito comprar?", aviso de sobrecompra, conteo guiado, Excel, respaldo/restauración, importación de productos, fotos. |
| **2. Nube** | Backend FastAPI + Postgres (Neon) | Sincronización en segundo plano, notificaciones push **con la app cerrada**, resumen diario automático, respaldos nocturnos de la base en la nube con prueba de restauración. |
| **3. Consulta a distancia** | La misma PWA en cualquier navegador | Inicio de sesión del administrador, modo consulta (solo lectura), avisos por Telegram (opcional), y luego escritura desde varios dispositivos. |

Cada fase tiene su propia spec, plan e implementación. Esta carpeta detalla la **Fase 1**; las Fases 2 y 3 se especifican al terminar la anterior, con lo aprendido en uso real.

## 6. Arquitectura

### 6.1 Vista general (todas las fases)

```
┌──────────── Celular (PWA) ─────────────┐          ┌──────── Nube (Fase 2) ────────┐
│  UI Vue 3 (vistas, componentes)        │          │  FastAPI (hexagonal + DDD)    │
│        │                               │          │   ├─ Sincronización           │
│  Aplicación (casos de uso)             │  HTTPS   │   ├─ Notificaciones push      │
│        │                               │ ───────► │   └─ Respaldos                │
│  Dominio (reglas de negocio, puro TS)  │ (Fase 2) │            │                  │
│        │ puertos                       │          │  Postgres (Neon)              │
│  Adaptadores: Dexie/IndexedDB,         │          │  Copias nocturnas (R2)        │
│  notificaciones, fotos, Excel          │          └───────────────────────────────┘
└────────────────────────────────────────┘
```

### 6.2 Arquitectura hexagonal por módulos

Cada módulo (bounded context) tiene cuatro capas. Las dependencias apuntan **hacia adentro**:

```
ui  ──►  application  ──►  domain  ◄──  infrastructure
```

| Capa | Contiene | Puede importar |
|---|---|---|
| `domain` | Entidades, objetos de valor, reglas, eventos de dominio, puertos (interfaces) | Solo `shared/domain` |
| `application` | Casos de uso que orquestan el dominio a través de puertos | `domain` |
| `infrastructure` | Adaptadores que implementan los puertos (Dexie, Notification API, fotos, Excel) | `domain`, `application`, librerías |
| `ui` | Vistas, componentes y composables de Vue | `application`, `shared/ui` |

La regla se **verifica automáticamente** con ESLint (`no-restricted-imports`): el dominio no puede importar Vue, Dexie ni nada de infraestructura. Ver [ADR-0005](../adr/0005-arquitectura-hexagonal-modular.md).

### 6.3 Módulos (bounded contexts)

| Módulo | Responsabilidad | Agregados / modelos | Fase |
|---|---|---|---|
| **Catálogo** | Qué se vende: productos, precios, unidades, categorías, foto | `Producto`, `Categoria` | 1 |
| **Inventario** | Cuánto hay y por qué cambió: operaciones y stock | `Operacion` (con sus `Movimiento`s), `Existencia` (proyección) | 1 |
| **Alertas** | Cuándo avisar: estado de stock y notificaciones | `EstadoDeStock`, `RegistroDeAviso` | 1 |
| **Análisis** | Qué está pasando: ganancias, predicción, lista de compras, tendencias (solo lectura) | `ResumenDiario` (proyección), cálculos puros | 1 |
| **Respaldo** | No perder datos: Excel, respaldo, restauración, importación | `Respaldo` | 1 |
| **Sincronización** | Mantener celular y nube iguales | `Cursor`, `Bandeja de salida` | 2 |
| **Notificaciones push** | Avisar con la app cerrada | `Suscripcion` | 2 |

### 6.4 Relaciones entre módulos

```
Catálogo ──(datos del producto: unidad, precios vigentes)──► Inventario
Inventario ──(evento OperacionRegistrada)──► Alertas, Análisis
Catálogo ──(evento ProductoActualizado)──► Alertas, Análisis
Análisis ──(venta promedio diaria)──► Alertas
Respaldo ──(lee/escribe todo, con validación)──► Catálogo, Inventario
```

- Los módulos se comunican por **casos de uso y eventos de dominio**, nunca leyendo las tablas internas de otro módulo.
- Los eventos se publican en un bus en memoria **después** de que la transacción local se confirma.

## 7. Lenguaje ubicuo

Se usan estos términos en código, specs y conversación. La columna *En pantalla* es lo que ve el usuario.

| Término | En pantalla | Definición |
|---|---|---|
| Producto | Producto | Algo que la tienda vende. Tiene unidad de medida, precio de compra y precio de venta. |
| Unidad de medida | unid. / kg / L | Cómo se cuenta un producto: `UNIDAD` (enteros), `KILO` o `LITRO` (con decimales). |
| Stock (Existencia) | "Quedan 5 unid." | Cantidad disponible. Es siempre la suma de los movimientos del producto. |
| Stock mínimo | "Avisarme cuando queden" | Cantidad a partir de la cual el producto se considera *por acabarse*. |
| Operación | (según tipo) | Hecho del negocio que cambia el stock: venta, ingreso, merma, ajuste, stock inicial o anulación. Es inmutable. |
| Movimiento | Línea | Efecto de una operación sobre un producto (con signo). |
| Venta | Vender | Operación de salida con precio de venta y costo guardados al momento. |
| Ingreso | Llegó mercadería | Operación de entrada con costo de compra. |
| Merma | Se dañó / se derramó / se venció | Salida de stock que no es venta. Es una pérdida. |
| Ajuste | Contar stock | Corrección del stock tras un conteo físico. |
| Anulación | Deshacer / Anular | Operación que revierte por completo a otra. |
| Costo unitario | Precio de compra | Lo que cuesta al negocio una unidad del producto. |
| Ganancia | Ganaste | Precio de venta menos costo, por la cantidad vendida. |
| Venta promedio diaria (VPD) | "Vendes ~2 al día" | Cantidad vendida por día con stock disponible, en las últimas 4 semanas. |
| Días de cobertura | "Se acaba en ~4 días" | Stock dividido entre la VPD. |
| Nivel objetivo | — | Cantidad que conviene tener después de comprar. |
| Cantidad sugerida | "Compra 6 unid." | Nivel objetivo menos stock, redondeado. |
| Lista para comprar | Para comprar | Productos que conviene reponer, con cantidades y costo estimado. |
| Producto parado | Productos parados | Producto con stock que no se vende hace 30 días o más. |
| Sobrecompra | "¿Seguro? Te alcanza para ~60 días" | Compra que deja stock para mucho más tiempo del razonable. |
| Conteo guiado | Contar todo | Recorrido producto por producto para registrar lo que hay realmente. |
| Torre de control | Control | Vista con todas las observaciones del negocio. |

## 8. Estructura del repositorio

```
predictive-inventory/
├─ frontend/                 Vue 3 + TypeScript (PWA)
│  └─ src/
│     ├─ app/                arranque, router, inyección de dependencias
│     ├─ modules/
│     │  ├─ catalogo/        domain · application · infrastructure · ui
│     │  ├─ inventario/
│     │  ├─ alertas/
│     │  ├─ analisis/
│     │  └─ respaldo/
│     └─ shared/             dominio común (Dinero, Cantidad, Fecha), UI base, base de datos
├─ backend/                  FastAPI (Fase 2), misma estructura hexagonal
├─ docs/
│  ├─ specs/                 especificaciones (este directorio)
│  ├─ adr/                   decisiones de arquitectura
│  └─ plans/                 planes de implementación
└─ .github/workflows/        CI
```

## 9. Decisiones de arquitectura

| ADR | Decisión |
|---|---|
| [0001](../adr/0001-local-first.md) | Local-first: PWA con IndexedDB (Dexie) y sincronización posterior |
| [0002](../adr/0002-libro-de-operaciones-inmutable.md) | El stock es la suma de un libro de operaciones inmutable |
| [0003](../adr/0003-enteros-para-dinero-y-cantidades.md) | Dinero en céntimos y cantidades en milésimas (enteros) |
| [0004](../adr/0004-costo-vigente-al-vender.md) | El costo de una venta es el precio de compra vigente al momento |
| [0005](../adr/0005-arquitectura-hexagonal-modular.md) | Arquitectura hexagonal por módulos, verificada con ESLint |
| [0006](../adr/0006-specs-ejecutables.md) | Specs Gherkin ejecutables, compartidas por frontend y backend |
| [0007](../adr/0007-hosting-github-pages.md) | Frontend publicado gratis en GitHub Pages |
| [0008](../adr/0008-postgres-neon.md) | Postgres en Neon para la nube (Fase 2) |
| [0009](../adr/0009-flujo-de-ramas-y-ci.md) | Flujo de ramas `main` / `develop` / `feat/*` con CI obligatorio |
| [0010](../adr/0010-versiones-y-publicacion.md) | Versiones SemVer, CHANGELOG y PR de entrega `release: vX.Y.Z` |
