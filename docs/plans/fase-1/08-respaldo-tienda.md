# Plan 08 — Módulos Tienda y Respaldo (RN-RE + configuración)

> **Para agentes:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Leer [00-plan-maestro.md](00-plan-maestro.md) y [04-08-ola-2-comun.md](04-08-ola-2-comun.md) primero.

**Objetivo:** (1) módulo **Tienda**: configuración del negocio, estado del sistema y primera vez; (2) módulo **Respaldo**: exportar a Excel, guardar/restaurar copia, importar productos desde Excel, recordatorio de copia y almacenamiento persistente.

**Rama:** `feat/respaldo-tienda` · **Spec:** [fase-1/README.md](../../specs/fase-1/README.md) (configuración), [05-respaldo-e-importacion.md](../../specs/fase-1/05-respaldo-e-importacion.md), [features/respaldo.feature](../../specs/fase-1/features/respaldo.feature).

## Archivos

```
src/modules/tienda/
├─ domain/configuracion.ts         validarCambios (rangos y mensajes)
├─ application/{puertos,casos,modulo}.ts
├─ infrastructure/memoria/repositorio.ts
└─ index.ts
src/modules/respaldo/
├─ domain/
│  ├─ formato-de-respaldo.ts       Respaldo v1: crear, leer/validar, migrar, resumen
│  ├─ hojas-de-excel.ts            hojaDeProductos, hojaDeMovimientos, hojaDeResumen, PLANTILLA
│  ├─ importacion.ts               leerFilas (encabezados, unidades, requeridos, repetidos)
│  ├─ recordatorio.ts              mensajeDeRecordatorio
│  └─ nombres-de-archivo.ts        slug, horaLocal
├─ application/
│  ├─ puertos.ts
│  ├─ copia.ts                     guardarCopia, prepararRestauracion, restaurarCopia
│  ├─ excel.ts                     exportarExcel, descargarPlantilla
│  ├─ importar.ts                  previsualizarImportacion, confirmarImportacion
│  ├─ sistema.ts                   recordatorioDeCopia, solicitarAlmacenamientoSiHaceFalta
│  └─ modulo.ts                    crearModuloRespaldo
├─ infrastructure/
│  ├─ memoria/{almacen-de-respaldo,dobles}.ts     AlmacenDeRespaldoEnMemoria, GeneradorDeExcelEnMemoria, LectorDeExcelEnMemoria, AlmacenamientoPersistenteEnMemoria
│  └─ navegador/{excel,almacenamiento,imagenes}.ts  write-excel-file / read-excel-file, navigator.storage, base64
└─ index.ts
```

## Interfaces que produce

```ts
// ───── tienda ─────
export interface RepositorioDeConfiguracion {
  negocio(): Promise<ConfiguracionRegistro | null>
  guardarNegocio(r: ConfiguracionRegistro): Promise<void>
  sistema(): Promise<EstadoDelSistemaRegistro | null>
  guardarSistema(r: EstadoDelSistemaRegistro): Promise<void>
}
export interface DependenciasDeTienda { repositorio: RepositorioDeConfiguracion; uow: UnidadDeTrabajo; ids: GeneradorDeIds; bus: BusDeEventos }
export interface ModuloTienda {
  obtenerConfiguracion(): Promise<ConfiguracionDeNegocio>
  actualizarConfiguracion(cambios: Partial<ConfiguracionDeNegocio>): Promise<void>   // publica ConfiguracionActualizada
  completarPrimeraVez(d: { nombreTienda: string; tamanoDeLetra: TamanoDeLetra }): Promise<void>
  consultable: TiendaConsultable
}
export function crearModuloTienda(d: DependenciasDeTienda): ModuloTienda

// ───── respaldo ─────
export interface DatosDelRespaldo {
  configuracion: ConfiguracionRegistro | null
  categorias: CategoriaRegistro[]
  productos: ProductoRegistro[]
  operaciones: OperacionRegistro[]
  avisos: AvisoRegistro[]
  fotos: { productoId: string; tipo: string; base64: string }[]
}
export interface AlmacenDeRespaldo {
  leerTodo(): Promise<DatosDelRespaldo>
  /** Reemplaza configuración del negocio, categorías, productos, operaciones, avisos y fotos. Vacía existencias, resúmenes, lista de compras y conteo. No toca el estado del sistema. */
  reemplazarTodo(d: DatosDelRespaldo): Promise<void>
}
export interface Reconstructor { reconstruirTodo(): Promise<void> }     // existencias + resúmenes (lo arma la composición)
export interface CeldaDeExcel { valor: string | number; formato?: '0.00' | '0.###' }
export interface HojaDeExcel { nombre: string; columnas: string[]; filas: CeldaDeExcel[][] }
export interface GeneradorDeExcel { generar(hojas: HojaDeExcel[]): Promise<Blob> }
export interface LectorDeExcel { leerPrimeraHoja(archivo: Blob): Promise<string[][]> }   // celdas como texto
export interface AlmacenamientoPersistente { solicitar(): Promise<boolean> }
export interface ArchivoGenerado { nombre: string; tipo: string; contenido: Blob }

export interface DependenciasDeRespaldo {
  almacen: AlmacenDeRespaldo
  reconstructor: Reconstructor
  generadorDeExcel: GeneradorDeExcel
  lectorDeExcel: LectorDeExcel
  almacenamiento: AlmacenamientoPersistente
  uow: UnidadDeTrabajo
  reloj: Reloj
  catalogo: () => CatalogoConsultable & { importacion: CatalogoParaImportacion }
  inventario: () => InventarioConsultable
  analisis: () => Pick<AnalisisConsultable, 'situaciones' | 'resumenesDeTienda'>
  tienda: () => TiendaConsultable
}
export interface ResumenDeCopia { productos: number; operaciones: number; desde: Dia | null; hasta: Dia | null; texto: string }
export interface Previsualizacion {
  validas: { fila: number; datos: DatosDeProductoNuevo; categoriaNombre: string }[]
  conProblemas: { fila: number; problema: string }[]
}
export const CONFIRMACIONES_PARA_RESTAURAR: readonly [string, string]
export interface ModuloRespaldo {
  guardarCopia(): Promise<ArchivoGenerado>
  prepararRestauracion(texto: string): Promise<{ resumen: ResumenDeCopia; confirmaciones: readonly [string, string] }>
  restaurarCopia(texto: string, d: { confirmaciones: number }): Promise<void>
  exportarExcel(): Promise<ArchivoGenerado & { hojas: HojaDeExcel[] }>
  descargarPlantilla(): Promise<ArchivoGenerado & { hojas: HojaDeExcel[] }>
  previsualizarImportacion(archivo: Blob): Promise<Previsualizacion>
  confirmarImportacion(p: Previsualizacion): Promise<{ importados: number }>
  recordatorioDeCopia(): Promise<string | null>
  solicitarAlmacenamientoSiHaceFalta(): Promise<void>
}
export function crearModuloRespaldo(d: DependenciasDeRespaldo): ModuloRespaldo
```

## Reglas y textos exactos

**Tienda**
- `estadoDelSistema()` crea el registro la primera vez con `dispositivoId = ids.nuevo()`, `primeraVezCompletada: false`, `ultimoRespaldoEn: null`, `almacenamientoPersistente: 'DESCONOCIDO'`, `ultimoResumenDelDiaMostrado: null`.
- `obtenerConfiguracion()` devuelve `CONFIGURACION_INICIAL` si no hay registro.
- Validación (`RANGOS_DE_CONFIGURACION`): nombre recortado vacío → `Escribe el nombre de tu tienda`; > 40 → `El nombre de la tienda puede tener hasta 40 letras`; días fuera de rango o no enteros → `Elige un número entre 1 y 60` (o `entre 1 y 14`, `entre 7 y 180` según el campo).

**Respaldo**
- Nombres de archivo: `slug` = `normalizar(nombreTienda)` con espacios → `-` y sin caracteres fuera de `[a-z0-9-]`; vacío → `tienda`. Excel: `inventario-<slug>-AAAA-MM-DD.xlsx`. Copia: `respaldo-<slug>-AAAA-MM-DD-HHmm.json` con hora de Lima (`2026-10-15 20:30` → `…-2026-10-15-2030.json`).
- **Copia v1 (RN-RE-02):** `{ versionDeFormato: 1, app: 'predictive-inventory', creadoEn, control: { productos, operaciones, stockPorProducto: { [id]: milésimas } }, datos: DatosDelRespaldo }`; `stockPorProducto` sale de `inventario().existencias()`. Sin existencias ni resúmenes. Tras guardar: `tienda().actualizarEstadoDelSistema({ ultimoRespaldoEn: ahora })`.
- **Leer copia:** JSON inválido, `app` distinto, falta `datos`/`control`, o `control.productos`/`control.operaciones` no coincide con el largo de los arreglos → `Este archivo no es una copia válida de la app`. `versionDeFormato > 1` → `Actualiza la app para abrir este respaldo` (RN-RE-05). `migrar()` es la identidad para v1 (punto de extensión).
- **Resumen (RN-RE-03):** `` `${formatearEntero(productos)} productos, ${formatearEntero(operaciones)} movimientos, del ${formatearDia(desde)} al ${formatearDia(hasta)}` `` (`desde`/`hasta` = primer y último `diaDe(ocurridaEn)`; sin operaciones: `` `${n} productos, sin movimientos` ``).
- `CONFIRMACIONES_PARA_RESTAURAR = ['Se reemplazarán todos los datos de este celular por los de la copia. ¿Continuar?', 'Esto no se puede deshacer. ¿Seguro que quieres restaurar?']`. `restaurarCopia` con menos de 2 confirmaciones → `Confirma dos veces para restaurar`.
- **Restaurar (RN-RE-03/04)** dentro de **una** UoW: `almacen.reemplazarTodo(datos)` → `reconstructor.reconstruirTodo()` → comparar `inventario().existencias()` con `control.stockPorProducto` (todos los productos del control); si difiere → lanzar `La copia tiene datos que no cuadran. No se cambió nada` (la UoW revierte todo). Si la copia es inválida, se lanza antes de tocar nada.
- **Excel (RN-RE-01):** hojas `Productos` (columnas: nombre, categoría, unidad, precio de compra, precio de venta, stock, stock mínimo, estado de stock, activo/archivado), `Movimientos` (fecha `DD/MM/AAAA HH:mm`, tipo, producto, cantidad, precio, costo, importe, anulada `sí`/`no`, nota — **una fila por movimiento**), `Resumen diario` (fecha `DD/MM/AAAA`, ventas, ganancia bruta, mermas, ganancia neta — `resumenesDeTienda(hoy − 89, hoy)`). Unidad como `unid.` / `kg` / `L`; montos `{ valor: número en soles, formato: '0.00' }`; cantidades `{ valor, formato: '0.###' }`; estado: `Agotado` / `Queda poco` / `Bien` (archivados: vacío).
- **Plantilla (RN-RE-07):** hoja `Productos` con columnas exactas `nombre, categoría, unidad, precio de compra, precio de venta, stock mínimo, stock inicial` y sin filas; hoja `Instrucciones` con una fila por columna explicando qué escribir (unidad: `unid`, `kg` o `L`).
- **Importar (RN-RE-07/08):** encabezados comparados con `normalizar`; falta una columna obligatoria → error `El archivo no tiene la columna "<nombre>". Usa la plantilla`. Fila *n* = número de fila de Excel (encabezado = 1). Filas totalmente vacías se ignoran. Por fila, en orden:
  1. requeridos vacíos → `falta el nombre` / `falta la categoría` / `falta la unidad` / `falta el precio de compra` / `falta el precio de venta` / `falta el stock mínimo`
  2. unidad: `unid|unidad|unidades|u` → UNIDAD; `kg|kilo|kilos` → KILO; `l|lt|litro|litros` → LITRO; otra → `la unidad "<x>" no es válida: usa unid, kg o L`
  3. repetida en el archivo (nombre normalizado ya visto) → `"<nombre tal cual>" está repetido en la fila <primera>`
  4. `catalogo().importacion.validarNuevo(datos)` con `categoriaId` = id existente o `'__nueva__'`: `NOMBRE_DUPLICADO` → `ya existe un producto llamado "<nombreExistente>"`; `CANTIDAD_ENTERA` → `<nombre> se cuenta por unidades enteras`; otro → el mensaje con la primera letra en minúscula.
  Problema final: `` `Fila ${n}: ${problema}` ``. `confirmarImportacion` crea las categorías que falten (una vez cada una) y llama `importacion.crear` por fila válida (con `stockInicial` si viene).
- **Recordatorio (RN-RE-06/09):** umbral = 3 días si `almacenamientoPersistente === 'RECHAZADO'`, si no 7. Nunca hubo copia → `Todavía no guardas una copia de tus datos`. `dias = diasEntre(diaDe(ultimoRespaldoEn), hoy) ≥ umbral` → `` `Hace ${dias} días que no guardas una copia` ``. Si no → `null`.
- **Almacenamiento persistente (RN-RE-09):** `solicitarAlmacenamientoSiHaceFalta()` solo si el estado es `DESCONOCIDO`: `almacenamiento.solicitar()` → guardar `CONCEDIDO` o `RECHAZADO`.

---

### Tarea 1: Módulo Tienda

**Archivos:** `src/modules/tienda/**` + specs.

Tests: valores iniciales; `estadoDelSistema` crea `dispositivoId` una sola vez; rangos y mensajes de cada campo; `actualizarConfiguracion` publica `ConfiguracionActualizada` después de guardar; `completarPrimeraVez` guarda nombre y letra y marca `primeraVezCompletada`.

- [ ] Rojo → verde → commit `feat(tienda): configuración del negocio y estado del sistema`.

### Tarea 2: Formato de copia, recordatorio y nombres (dominio)

**Archivos:** `src/modules/respaldo/domain/{formato-de-respaldo,recordatorio,nombres-de-archivo}.ts` + specs.

Tests: RN-RE-02 (control con 2 productos, 2 operaciones y stock `12500` de Carbón; sin existencias/resúmenes en `datos`), lectura de copia dañada (JSON roto, `app` ajeno, conteos que no cuadran) → mensaje exacto, RN-RE-05 (versión 2 → mensaje exacto), resumen `152 productos, 3 840 movimientos, del 01/10/2026 al 15/12/2026`, RN-RE-06 (las cuatro filas del esquema), RN-RE-09 (rechazado y 3 días → `Hace 3 días que no guardas una copia`), nombres `inventario-bodega-rosita-2026-10-15.xlsx` y `respaldo-bodega-rosita-2026-10-15-2030.json`.

- [ ] Rojo → verde → commit `feat(respaldo): formato de copia v1, recordatorio y nombres de archivo`.

### Tarea 3: Hojas de Excel e importación (dominio)

**Archivos:** `domain/hojas-de-excel.ts`, `domain/importacion.ts` + specs.

Tests: RN-RE-01 (con Lejía vendida 2: fila de Productos `Lejía 1 L | unid. | 2.40 | 3.50 | 8 | 3 | Bien`; 3 filas de Movimientos; fila de Resumen `15/10/2026 | 7.00 | 2.20 | 0.00 | 2.20`), plantilla con las columnas exactas, RN-RE-07 (filas 2–5 del escenario: 2 válidas, problemas `Fila 4: falta el precio de venta` y `Fila 5: Bolsas chicas se cuenta por unidades enteras` — este último viene del paso 4 con un catálogo falso), RN-RE-08 (`Fila 2: ya existe un producto llamado "Lejía 1 L"`, `Fila 4: "detergente" está repetido en la fila 3`), columna faltante, unidades válidas e inválidas.

- [ ] Rojo → verde → commit `feat(respaldo): hojas de Excel y lectura de importación con mensajes simples`.

### Tarea 4: Casos de uso, dobles en memoria y adaptadores del navegador

**Archivos:** `application/*`, `infrastructure/memoria/*`, `infrastructure/navegador/*`, `index.ts` + specs.

- `AlmacenDeRespaldoEnMemoria` (sobre `AlmacenEnMemoria`): `leerTodo` lee las tablas; `reemplazarTodo` vacía y escribe según el contrato. Fotos: `Blob` ↔ base64 con `navegador/imagenes.ts` (`blob.arrayBuffer()` + `btoa`), que también funciona en jsdom.
- `GeneradorDeExcelEnMemoria` guarda las hojas recibidas y devuelve un `Blob` vacío; `LectorDeExcelEnMemoria` devuelve filas fijas.
- Adaptadores reales: `navegador/excel.ts` con `write-excel-file` (`npm i write-excel-file read-excel-file`; usar la entrada para navegador) y `read-excel-file`; `navegador/almacenamiento.ts` con `navigator.storage?.persist?.() ?? false`. Agregar un test de ida y vuelta del Excel **real** en Node si las librerías lo permiten (entradas `/node`); si no, documentar en el reporte por qué no.

Tests de casos de uso (con un reconstructor y dobles de catálogo/inventario/análisis/tienda sencillos):
- `guardarCopia` → archivo `respaldo-…json`, y `ultimoRespaldoEn` actualizado.
- RN-RE-03: `prepararRestauracion` devuelve el resumen y las dos confirmaciones; `restaurarCopia(…, { confirmaciones: 1 })` → error; con 2 → datos reemplazados.
- RN-RE-03: copia dañada → error y el almacén queda igual.
- RN-RE-04: control que dice 99 para Carbón pero el reconstructor deja 12.5 → error exacto y **todo** vuelve como estaba (gracias a la UoW).
- RN-RE-07/08: `confirmarImportacion` crea `Detergentes` una sola vez y llama `crear` con `stockInicial: '10'`.
- RN-RE-09: estado `DESCONOCIDO` → se solicita y se guarda el resultado; si ya es `CONCEDIDO`, no se vuelve a pedir.

- [ ] Rojo → verde → verificación final de la rama → commit `feat(respaldo): copia, restauración segura, Excel e importación`.
