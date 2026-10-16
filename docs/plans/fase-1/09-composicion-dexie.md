# Plan 09 — Ola 3: transacciones con eventos diferidos, composición, Dexie y arranque de la app

> **Para agentes:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Leer [00-plan-maestro.md](00-plan-maestro.md) y [04-08-ola-2-comun.md](04-08-ola-2-comun.md). Este plan **sí** toca todos los módulos y `src/shared/**`: es la ola de integración.

**Objetivo:** que los seis módulos funcionen juntos, persistan en IndexedDB (Dexie) y la app arranque en el navegador con datos reales; más los ajustes transversales que dejaron las revisiones de la Ola 2.

**Ramas (ejecución en paralelo):**

| Rama | Tareas | Depende de |
|---|---|---|
| `feat/eventos-diferidos` (A) | Tarea 1 completa + Tarea 5 salvo los puntos de Dexie | — |
| `feat/persistencia-dexie` (B) | Tarea 2 + puntos de Dexie de la Tarea 5 (`guardarVarios`/bulkPut en Análisis, lecturas de `cargarDatos` dentro de `uow.ejecutar`, orden de `porProducto`/`todas` en Dexie) | — (implementa `alConfirmar` en la UoW Dexie según la interfaz de este plan) |
| `feat/composicion` (C) | Tareas 3 y 4 | A y B integradas |

A y B salen de `develop` al mismo tiempo; C sale de `develop` después de integrarlas.

**Spec:** ADR-0001, ADR-0002, ADR-0005, ADR-0007; [03-alertas.md](../../specs/fase-1/03-alertas.md) (tocar la notificación abre su pantalla); [05-respaldo-e-importacion.md](../../specs/fase-1/05-respaldo-e-importacion.md) (RN-RE-09); [07-calidad.md](../../specs/fase-1/07-calidad.md) (RN-SIS-08, RN-SIS-09).

## Decisiones ya tomadas (rulings del controlador)

1. **Eventos tras el commit más externo.** `UnidadDeTrabajo` gana `alConfirmar(accion: () => void | Promise<void>): void`. Dentro de una transacción, encola la acción y la ejecuta **después del commit de la transacción más externa**, en orden; si hay rollback, se descartan. Fuera de una transacción, la ejecuta enseguida. Todos los casos de uso dejan de publicar "después de `ejecutar`" y pasan a `uow.alConfirmar(() => bus.publicar(…))`; lo mismo `deshacer.ofrecer(…)`.
2. **Operaciones creadas por Catálogo no ofrecen Deshacer.** `registrarStockInicial` y `retirarStock` (API `InventarioParaCatalogo`) registran la operación sin ofrecer Deshacer.
3. **Ayudantes de prueba fuera de la app.** `tsconfig.app.json` excluye `src/**/__pruebas__/**`; `tsconfig.vitest.json` los incluye. Los ayudantes `__pruebas__` pueden volver a importar la UoW de pruebas directamente si simplifica.
4. **Alertas:** `esperarEvaluacionesPendientes()` espera en bucle hasta que la cola no cambie (los pasos Gherkin encadenan eventos).
5. **Tocar una notificación** abre su `data.url` resuelta contra el `scope` del Service Worker (base `/predictive-inventory/`), enfocando una ventana abierta si existe.

## Estructura

```
frontend/src/
├─ shared/application/unidad-de-trabajo.ts          + alConfirmar
├─ shared/infrastructure/memoria/unidad-de-trabajo-en-memoria.ts   + alConfirmar
├─ shared/infrastructure/dexie/
│  ├─ base-de-datos.ts                  class BaseDeDatos extends Dexie ('predictive-inventory', versión 1, esquema abajo)
│  ├─ unidad-de-trabajo-dexie.ts        transacción 'rw' sobre todas las tablas; anidadas se unen (Dexie.currentTransaction); alConfirmar
│  └─ *.spec.ts                         con fake-indexeddb
├─ modules/<modulo>/infrastructure/dexie/repositorios.ts (+ spec)   uno por módulo, implementa sus puertos
├─ modules/respaldo/infrastructure/dexie/almacen-de-respaldo.ts
├─ app/
│  ├─ composicion.ts                    crearAplicacion(infra): Aplicacion  (cablea módulos con referencias perezosas)
│  ├─ infraestructura-navegador.ts      crearInfraestructuraDelNavegador(): Infraestructura (Dexie + adaptadores reales)
│  ├─ abrir-app.ts                      abrirApp(aplicacion) → { primeraVez, resumenDelDia, recordatorioDeCopia }
│  ├─ proveer-aplicacion.ts             plugin Vue: provide + useAplicacion()
│  └─ estado-global.ts                  store Pinia: contador de atención, resumen, recordatorio; se refresca con eventos
├─ main.ts                              arranque: infraestructura → aplicación → abrirApp → montar
└─ (public)/sw-notificaciones.js        notificationclick, importado por workbox (importScripts)
frontend/tests/
├─ soporte/aplicacion-de-prueba.ts      crearAplicacionDePrueba({ ahora, almacen?: 'memoria' | 'dexie' }) con reloj fijo, ids secuenciales, notificador en memoria, etc.
└─ integracion/*.spec.ts                flujos entre módulos, corridos con memoria Y con Dexie (fake-indexeddb)
```

**Esquema Dexie (versión 1):**

| Tabla | Índices |
|---|---|
| `productos` | `id, nombreNormalizado, categoriaId, estado` |
| `categorias` | `id, nombreNormalizado` |
| `operaciones` | `id, tipo, ocurridaEn, registradaEn, anulaA, *productoIds` |
| `existencias` | `productoId` |
| `resumenes` | `clave, dia, productoId, [productoId+dia]` |
| `configuracion` | `clave` |
| `avisos` | `productoId` |
| `listaDeCompras` | `dia` |
| `conteo` | `id` |
| `fotos` | `productoId` |

`operaciones.todas()` y `porProducto()` devuelven en **orden de registro** (`registradaEn`, desempate estable). `resumenes.deProductoEntre / primerDiaDe / ultimoDiaConVentaDe` usan `[productoId+dia]`; `entre` usa `dia`. Ninguna operación de repositorio espera promesas ajenas a IndexedDB dentro de una transacción (Dexie confirmaría antes de tiempo).

## Interfaces

```ts
// shared/application/unidad-de-trabajo.ts
export interface UnidadDeTrabajo {
  ejecutar<T>(trabajo: () => Promise<T>): Promise<T>
  /** Corre la acción tras el commit de la transacción MÁS EXTERNA (o enseguida si no hay transacción). Se descarta si hay rollback. */
  alConfirmar(accion: () => void | Promise<void>): void
}

// app/composicion.ts
export interface Infraestructura {
  uow: UnidadDeTrabajo; reloj: Reloj; ids: GeneradorDeIds; bus: BusDeEventos
  // repositorios por módulo (los puertos de cada módulo), adaptadores:
  notificador: Notificador; procesadorDeFotos: ProcesadorDeFotos
  generadorDeExcel: GeneradorDeExcel; lectorDeExcel: LectorDeExcel
  almacenamiento: AlmacenamientoPersistente; almacenDeRespaldo: AlmacenDeRespaldo
  // … (completar con los puertos reales que exportan los index de cada módulo)
}
export interface Aplicacion {
  catalogo: ModuloCatalogo; inventario: ModuloInventario; analisis: ModuloAnalisis
  alertas: ModuloAlertas; respaldo: ModuloRespaldo; tienda: ModuloTienda
  bus: BusDeEventos
  /** Para pruebas y pasos Gherkin: espera evaluaciones de alertas y acciones alConfirmar pendientes. */
  esperarTareasPendientes(): Promise<void>
}
export function crearAplicacion(infra: Infraestructura): Aplicacion
```

`Reconstructor` de Respaldo = `inventario.reconstruirExistencias()` (que ya reconstruye proyecciones). Las proyecciones registradas en Inventario = `[analisis.proyeccion]`.

---

### Tarea 1: `alConfirmar` y su adopción en todos los módulos

- [ ] Tests primero en `unidad-de-trabajo-en-memoria.spec.ts`: acción fuera de transacción corre enseguida; dentro, corre tras el commit externo y en orden; anidada espera al externo; rollback descarta; una acción que lanza se registra (console.error) sin afectar a las demás.
- [ ] Implementar en la UoW en memoria (token de ALS con lista de acciones).
- [ ] Reemplazar en **cada** módulo la publicación de eventos posterior a `ejecutar` por `uow.alConfirmar(...)` dentro de la UoW (catálogo, inventario —incluido `deshacer.ofrecer`—, análisis si publica, alertas, tienda, respaldo). Agregar en cada módulo un test: si una UoW externa falla después de la llamada anidada, no se publica nada.
- [ ] Ruling 2 (sin Deshacer para stock inicial/retiro) con test.
- [ ] Ruling 3 (tsconfig `__pruebas__`) y Ruling 4 (espera en bucle) con test.
- [ ] Verificación completa → commit `refactor: eventos y Deshacer después del commit más externo (alConfirmar)`.

### Tarea 2: Dexie: base, UoW y repositorios

- [ ] `npm i dexie` y `npm i -D fake-indexeddb` (en tests: `import 'fake-indexeddb/auto'` en un setup de Vitest solo para specs de `infrastructure/dexie`).
- [ ] Base de datos con el esquema de arriba; UoW Dexie (anidadas se unen; `alConfirmar` tras el commit externo; prueba de rollback real de IndexedDB).
- [ ] Repositorios Dexie de cada módulo, probados con **los mismos casos** que sus repos en memoria. Recomendado: extraer los specs en memoria a funciones de contrato (`probarRepositorioDeX(crear)`) y correrlas contra ambas implementaciones.
- [ ] `AlmacenDeRespaldo` en Dexie: `reemplazarTodo` limpia y escribe en una transacción.
- [ ] Commit `feat(persistencia): base local IndexedDB con Dexie y repositorios por módulo`.

### Tarea 3: Composición y aplicación de prueba

- [ ] `crearAplicacion` con referencias perezosas entre módulos; `alertas.escucharEventos()` activado; `esperarTareasPendientes`.
- [ ] `tests/soporte/aplicacion-de-prueba.ts` (memoria o Dexie con fake-indexeddb), con `RelojFijo`, `IdsSecuenciales`, `NotificadorEnMemoria`, generador/lector de Excel en memoria, almacenamiento persistente en memoria.
- [ ] `tests/integracion/`: (a) crear producto con stock inicial → vender → alerta "Queda poco" → torre muestra ganancia; (b) ingreso con costo distinto + sobrecompra; (c) archivar con stock (retiro sin Deshacer); (d) guardar copia → vender → restaurar → stock vuelve; (e) importar Excel → productos y stock inicial; (f) conteo guiado. Cada uno corre con memoria **y** con Dexie, y los resultados deben ser idénticos.
- [ ] RN-SIS-09 (rendimiento): con 300 productos y 50 000 movimientos generados (Dexie + fake-indexeddb), `consultarTorre()` < 1 s y una venta < 300 ms en la máquina de CI (medir; si fake-indexeddb distorsiona, documentar y dejar el umbral para el E2E de la Ola 5).
- [ ] Commit `feat(app): composición de módulos y aplicación de prueba`.

### Tarea 4: Arranque en el navegador

- [ ] `infraestructura-navegador.ts` con Dexie y adaptadores reales (NotificadorDelSistema, ProcesadorDeFotosCanvas, Excel del navegador, `navigator.storage`).
- [ ] `abrir-app.ts`: estado del sistema (crea `dispositivoId`), solicitar almacenamiento si hace falta (RN-RE-09), sembrar categorías iniciales, aplicar tamaño de letra de la configuración, evaluar avisos (RN-AL-02), devolver primera vez / resumen del día / recordatorio de copia.
- [ ] `proveer-aplicacion.ts` + `estado-global.ts` (Pinia): contador de atención para la barra (`BarraNavegacion.contadorControl`), refrescado con eventos; la letra se guarda también en la copia rápida de `localStorage` (`aplicarTamanoDeLetra`).
- [ ] `main.ts`: crea infraestructura → aplicación → `abrirApp` → monta; si IndexedDB falla (modo privado), muestra una pantalla de error amable.
- [ ] Service Worker: `public/sw-notificaciones.js` con `notificationclick` (Ruling 5) y `workbox.importScripts` en `vite.config.ts`.
- [ ] E2E mínimo: la app arranca, siembra categorías, `LayoutApp` muestra el contador real (0) y la navegación sigue funcionando; offline tras la primera carga (RN-SIS-08) con el build de preview.
- [ ] Verificación completa (lint:ci, type-check, test:cobertura, build, verificar-specs, playwright) → commit `feat(app): arranque con datos locales y notificaciones que abren su pantalla`.

### Tarea 5: Ajustes menores que dejaron las revisiones de la Ola 2 (rulings)

Cada uno con su test; commit por módulo (`fix(<modulo>): …`).

- **Análisis:**
  - "No encontré ese producto" → `No encontramos ese producto` (mismo texto que Catálogo); `quitarDeLista` también valida el producto.
  - RN-AN-16 caso 2 usa la cantidad **editada** del día; si el producto se quitó de la lista de hoy, cae al caso 3.
  - Mejor día con todos los promedios en S/ 0.00 → `{ tipo: 'insuficiente', mensaje: 'Todavía no hay ventas para saberlo' }`.
  - VPD < 0.05 → `Vendes menos de 0.1 <unidad> al día`; stock 0 → `textoCobertura` null.
  - En Dexie, `cargarDatos` lee `existencias()` y `entre()` dentro de una transacción de solo lectura; `reconstruir` usa escritura masiva (`bulkPut`, agregando `guardarVarios` al puerto); `primerDiaDe` ignora filas que solo quedaron por operaciones anuladas.
- **Catálogo:** el procesador de fotos mapea también los errores de dibujo/codificación a `FOTO_INVALIDA`; pinta fondo blanco antes de `drawImage` cuando codifica a JPEG; detecta el soporte de WebP una sola vez por sesión.
- **Inventario:** `normalizarInstante` exige zona explícita (`Z` u offset); un valor con hora pero sin zona, vacío o ilegible se rechaza con `ErrorDeDominio('FECHA_INVALIDA', 'Elige la fecha y la hora')` (nunca un `Error` plano); `porProducto` también se ordena por `registradaEn`.
- **Inventario (cont.):** Dexie devuelve `todas()` / `porProducto()` ordenadas por `registradaEn`. Después de `revisarDatos()`, `reconstruirExistencias()` o una restauración de copia, la composición llama `alertas.evaluarAvisos()` (los estados pueden haber cambiado sin un evento de operación).
- **Respaldo:** tras `restaurarCopia`, la composición recarga la configuración (letra, etc.) y llama `alertas.evaluarAvisos()`. El `AlmacenDeRespaldo` de Dexie lee los registros en una transacción y convierte las fotos a base64 DESPUÉS de cerrarla (`blob.arrayBuffer()` cerraría la transacción de IndexedDB).
- Agregar a la spec (rama `docs/*`, antes del código): los mensajes nuevos aceptados en la Ola 2 — `La nota puede tener hasta 200 caracteres`, `Ya pasó el tiempo para deshacer. Puedes anularla desde el Historial.`, `Pusiste el mismo producto dos veces con distinto precio. Déjalo en una sola línea.`, `Elige la fecha y la hora`, `Agrega al menos un producto`, `No contaste ningún producto.`, `No encontramos ese producto`, `Todavía no hay ventas para saberlo`, `No pudimos leer la foto. Prueba con otra.` — y corregir 02-operaciones: `OperacionRegistrada` lleva los productos afectados (no las existencias resultantes).
