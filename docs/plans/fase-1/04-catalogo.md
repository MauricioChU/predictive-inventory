# Plan 04 — Módulo Catálogo (RN-CAT)

> **Para agentes:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Leer [00-plan-maestro.md](00-plan-maestro.md) y [04-08-ola-2-comun.md](04-08-ola-2-comun.md) primero.

**Objetivo:** productos, categorías y fotos, con todas las reglas RN-CAT vigentes, expuestos como casos de uso y como `CatalogoConsultable` / `CatalogoParaImportacion`.

**Rama:** `feat/catalogo` · **Spec:** [01-catalogo.md](../../specs/fase-1/01-catalogo.md), [features/catalogo.feature](../../specs/fase-1/features/catalogo.feature).

**Consume:** `@/shared/domain/*`, `@/shared/contratos/*`, `@/shared/application/*`, `AlmacenEnMemoria`. De otros módulos (perezosos): `InventarioParaCatalogo`, `AnalisisConsultable['vecesVendido']`.

## Archivos

```
src/modules/catalogo/
├─ domain/
│  ├─ validaciones.ts        leerNombre, leerPrecioCompra, leerPrecioVenta, leerStockMinimo, leerStockInicial
│  ├─ producto.ts            agregado Producto
│  ├─ categoria.ts           agregado Categoria + CATEGORIAS_INICIALES
│  ├─ busqueda.ts            coincide(), ordenarResultados()
│  ├─ mensajes.ts            mensajePerdida(), mensajeRetiro()
│  └─ foto.ts                dimensionesReducidas(), comprimirHasta()
├─ application/
│  ├─ puertos.ts
│  ├─ productos.ts           crear, editar, archivar, reactivar, obtener, buscar, validarNuevo
│  ├─ categorias.ts          listar, crear, renombrar, eliminar, sembrarIniciales, porNombre
│  ├─ fotos.ts               guardarFoto, obtenerFoto, quitarFoto
│  └─ modulo.ts              crearModuloCatalogo
├─ infrastructure/
│  ├─ memoria/repositorios.ts   RepositorioDeProductosEnMemoria, …DeCategorias…, …DeFotos…
│  └─ navegador/procesador-de-fotos-canvas.ts   ProcesadorDeFotosCanvas (no se prueba en jsdom)
└─ index.ts
```

## Interfaces que produce (otros planes dependen de estos nombres)

```ts
// application/puertos.ts
export interface RepositorioDeProductos {
  guardar(r: ProductoRegistro): Promise<void>
  porId(id: string): Promise<ProductoRegistro | null>
  porNombreNormalizado(n: string): Promise<ProductoRegistro | null>
  todos(): Promise<ProductoRegistro[]>
  hayConCategoria(categoriaId: string): Promise<boolean>
}
export interface RepositorioDeCategorias {
  guardar(r: CategoriaRegistro): Promise<void>
  porId(id: string): Promise<CategoriaRegistro | null>
  porNombreNormalizado(n: string): Promise<CategoriaRegistro | null>
  todas(): Promise<CategoriaRegistro[]>
  eliminar(id: string): Promise<void>
}
export interface RepositorioDeFotos {
  guardar(r: FotoRegistro): Promise<void>
  obtener(productoId: string): Promise<Blob | null>
  eliminar(productoId: string): Promise<void>
}
export interface ProcesadorDeFotos {
  /** Reduce a ≤ 512 px en el lado mayor y comprime a ≤ 100 KB (RN-CAT-14). */
  reducir(imagen: Blob): Promise<Blob>
}

// application/modulo.ts
export interface DependenciasDeCatalogo {
  productos: RepositorioDeProductos
  categorias: RepositorioDeCategorias
  fotos: RepositorioDeFotos
  procesadorDeFotos: ProcesadorDeFotos
  uow: UnidadDeTrabajo
  reloj: Reloj
  ids: GeneradorDeIds
  bus: BusDeEventos
  inventario: () => InventarioParaCatalogo
  ventas: () => Pick<AnalisisConsultable, 'vecesVendido'>
}

export interface ProductoVista {
  id: string; nombre: string; categoriaId: string; categoriaNombre: string; unidad: Unidad
  precioCompra: Dinero; precioVenta: Dinero; gananciaPorUnidad: Dinero
  stockMinimo: Cantidad; stock: Cantidad; activo: boolean; tieneFoto: boolean
}
export interface CategoriaVista { id: string; nombre: string }

export interface DatosDeEdicion {
  productoId: string
  nombre?: string; categoriaId?: string; unidad?: Unidad
  precioCompra?: string; precioVenta?: string; stockMinimo?: string
  confirmado?: boolean
}

export interface ModuloCatalogo {
  crearProducto(datos: DatosDeProductoNuevo & { confirmado?: boolean }): Promise<Respuesta<{ productoId: string }>>
  editarProducto(datos: DatosDeEdicion): Promise<Respuesta<void>>
  archivarProducto(datos: { productoId: string; confirmado?: boolean }): Promise<Respuesta<void>>
  reactivarProducto(productoId: string): Promise<void>
  obtenerProducto(productoId: string): Promise<ProductoVista | null>
  buscarProductos(filtro: { texto: string; archivados?: boolean }): Promise<ProductoVista[]>
  listarCategorias(): Promise<CategoriaVista[]>
  crearCategoria(nombre: string): Promise<string>
  renombrarCategoria(categoriaId: string, nombre: string): Promise<void>
  eliminarCategoria(categoriaId: string): Promise<void>
  sembrarCategoriasIniciales(): Promise<void>
  guardarFoto(productoId: string, imagen: Blob): Promise<void>
  obtenerFoto(productoId: string): Promise<Blob | null>
  quitarFoto(productoId: string): Promise<void>
  consultable: CatalogoConsultable
  importacion: CatalogoParaImportacion
}
export function crearModuloCatalogo(dependencias: DependenciasDeCatalogo): ModuloCatalogo
```

## Reglas y mensajes exactos

| Regla | Comportamiento | Mensaje |
|---|---|---|
| RN-CAT-01 | nombre recortado vacío | `Escribe el nombre del producto` |
| RN-CAT-01 | largo < 2 o > 80 (tras recortar) | `El nombre debe tener entre 2 y 80 letras` |
| RN-CAT-01 | `normalizar(nombre)` igual a un producto **activo** | `Ya existe un producto con ese nombre` (código `NOMBRE_DUPLICADO`) |
| RN-CAT-02 | igual a uno **archivado** | no crea; `ofrecerReactivar(id, nombre)` (en validarNuevo: código `NOMBRE_DUPLICADO` con `nombreExistente`) |
| RN-CAT-03 | cambiar unidad con operaciones (`inventario().tieneOperaciones`) | `No puedes cambiar la unidad de un producto que ya tiene movimientos` |
| RN-CAT-04 | compra < 0 | `El precio de compra no puede ser negativo` |
| RN-CAT-04 | venta ≤ 0 | `El precio de venta debe ser mayor que S/ 0.00` |
| RN-CAT-04 | cualquier precio > 9 999 999 céntimos | `El precio no puede pasar de S/ 99 999.99` |
| RN-CAT-04 | > 2 decimales / texto inválido | los de `Dinero.deTexto` |
| RN-CAT-05 | venta < compra y no confirmado | `confirmar('Vas a perder S/ X por cada <unidad>')` |
| RN-CAT-05 | venta = compra y no confirmado | `confirmar('Con este precio no ganas nada por cada <unidad>')` |
| RN-CAT-06 | mínimo con decimales en UNIDAD / > 3 decimales | los de `Cantidad.deTexto` |
| RN-CAT-06 | mínimo < 0 | `El stock mínimo no puede ser negativo` |
| RN-CAT-08 | stock inicial < 0 | `El stock inicial no puede ser negativo` |
| RN-CAT-08 | stock inicial > 0 | `inventario().registrarStockInicial(id, cantidad, precioCompra)` en la misma UoW |
| RN-CAT-11 | archivar con stock > 0 y no confirmado | `confirmar(mensajeRetiro(stock, unidad))` |
| RN-CAT-11 | archivar confirmado | `inventario().retirarStock(id)` y archivar, misma UoW |
| RN-CAT-15 | nombre de categoría < 2 o > 40 | `El nombre de la categoría debe tener entre 2 y 40 letras` |
| RN-CAT-15 | categoría repetida (normalizada) | `Ya existe una categoría con ese nombre` |
| RN-CAT-15 | eliminar con productos | `La categoría tiene productos. Puedes cambiarle el nombre` |
| — | producto o categoría inexistente | `No encontramos ese producto` / `No encontramos esa categoría` |
| — | `categoriaId` que no existe al crear/editar | `Elige una categoría` |

`<unidad>`: `unidad` (UNIDAD), `kilo` (KILO), `litro` (LITRO).

`mensajeRetiro(stock, unidad)`: `Aún queda 1 unid. ¿La retiramos del stock?` / `Aún quedan 4 unid. ¿Las retiramos del stock?` (UNIDAD); para KILO/LITRO: `Aún queda 1 kg. ¿Lo retiramos del stock?` / `Aún quedan 2.5 kg. ¿Los retiramos del stock?`. Singular solo si la cantidad es exactamente 1.

Orden de validación al crear: nombre → unicidad → categoría → precio de compra → precio de venta → stock mínimo → stock inicial → (confirmación de pérdida).

Búsqueda (RN-CAT-12): `palabras = normalizar(texto).split(' ').filter(Boolean)`; coincide si **cada** palabra está contenida en `nombreNormalizado`. Texto vacío → todos. `archivados: true` → solo archivados; si no, solo activos. Orden: `ventas().vecesVendido(hoy − 29, hoy)` descendente, luego `nombreNormalizado` con `localeCompare(…, 'es')`.

Foto (RN-CAT-14): `dimensionesReducidas(4000, 3000, 512) → { ancho: 512, alto: 384 }` (no agranda imágenes chicas); `comprimirHasta(codificar: (calidad: number) => Promise<Blob>, maximoBytes = 102_400)` prueba calidades `[0.85, 0.75, 0.65, 0.55, 0.45, 0.35]` y devuelve la primera ≤ máximo; si ninguna sirve, `ErrorDeDominio('FOTO_PESADA', 'No pudimos achicar la foto. Prueba con otra.')`. `ProcesadorDeFotosCanvas` usa `createImageBitmap` + `OffscreenCanvas` (o `<canvas>`) y `convertToBlob({ type: 'image/webp', quality })`.

Eventos tras confirmar: `ProductoCreado` (crear), `ProductoActualizado` (editar y `actualizarPrecioCompra`), `ProductoArchivado`, `ProductoReactivado`.

Categorías iniciales (orden): Lejías y desinfectantes · Detergentes y jabones · Lavavajillas · Limpiadores y ceras · Papel y descartables · Bolsas · Escobas, trapeadores y accesorios · Ambientadores e insecticidas · Carbón y combustibles · Otros. `sembrarCategoriasIniciales` solo crea si no hay ninguna.

---

### Tarea 1: Validaciones y agregado `Producto`

**Archivos:** `domain/validaciones.ts`, `domain/producto.ts`, `domain/mensajes.ts` y sus `*.spec.ts`.

```ts
// domain/producto.ts (forma)
export class Producto {
  static crear(p: { id: string; nombre: string; categoriaId: string; unidad: Unidad; precioCompra: Dinero; precioVenta: Dinero; stockMinimo: Cantidad; ahora: Instante }): Producto
  static desdeRegistro(r: ProductoRegistro): Producto
  aRegistro(): ProductoRegistro
  get id(): string; get nombre(): string; get nombreNormalizado(): string; get unidad(): Unidad
  get categoriaId(): string; get precioCompra(): Dinero; get precioVenta(): Dinero; get stockMinimo(): Cantidad
  get activo(): boolean; get tieneFoto(): boolean
  renombrar(nombre: string, ahora: Instante): void
  cambiarCategoria(categoriaId: string, ahora: Instante): void
  cambiarPrecios(compra: Dinero, venta: Dinero, ahora: Instante): void
  cambiarStockMinimo(minimo: Cantidad, ahora: Instante): void
  cambiarUnidad(unidad: Unidad, tieneOperaciones: boolean, ahora: Instante): void   // RN-CAT-03
  archivar(ahora: Instante): void; reactivar(ahora: Instante): void
  marcarFoto(tiene: boolean, ahora: Instante): void
  /** null si gana; S/ 0.00 o más si pierde (RN-CAT-05). */
  perdidaPorUnidad(): Dinero | null
}
```
Tests (mínimos, nombres con su regla): RN-CAT-01 (vacío, `"L"`, 81 letras, 80 letras ok), RN-CAT-04 (todos los ejemplos del Esquema de `catalogo.feature`: `2.40/3.50`, `0.00/1.00`, `2,40/3,50`, `2.40/0.00`, `-1.00/3.50`, `2.405/3.50`, `2.40/100000.00`), RN-CAT-05 (`5.00/4.50` → pérdida 50 céntimos; mensaje exacto `Vas a perder S/ 0.50 por cada unidad`; igual → mensaje de "no ganas nada"; KILO → "por cada kilo"), RN-CAT-06 (todos los ejemplos del esquema), RN-CAT-03 (cambiar unidad con y sin operaciones), `mensajeRetiro` (4 unid., 1 unid., 2.5 kg, 1 kg), ida y vuelta `aRegistro`/`desdeRegistro`.

- [ ] Tests en rojo → implementación → verde → commit `feat(catalogo): agregado Producto y validaciones RN-CAT`.

### Tarea 2: Categorías, búsqueda y foto (dominio)

**Archivos:** `domain/categoria.ts`, `domain/busqueda.ts`, `domain/foto.ts` y sus `*.spec.ts`.

Tests: RN-CAT-15 (largo 2–40, igualdad normalizada `carbon y combustibles` = `Carbón y combustibles`), RN-CAT-12 (todos los ejemplos del Esquema de búsqueda: `lejia`, `1 l lejia`, `CARBON`, `trad 2`, `detergente` → vacío; orden por veces vendido con el ejemplo "Los más vendidos aparecen primero": 1 L con 1 venta, 2 L con 2 → 2 L primero; empate → por nombre), RN-CAT-14 (`dimensionesReducidas(4000,3000)` → 512×384, `(3000,4000)` → 384×512, `(300,200)` → sin cambio; `comprimirHasta` con un codificador falso que devuelve 300 KB, 150 KB, 90 KB → devuelve el de 90 KB; todos > 100 KB → error `FOTO_PESADA`).

- [ ] Rojo → verde → commit `feat(catalogo): categorías, búsqueda sin tildes y reducción de fotos`.

### Tarea 3: Repositorios en memoria

**Archivos:** `infrastructure/memoria/repositorios.ts`, `infrastructure/memoria/repositorios.spec.ts`.

Implementan los tres puertos sobre `AlmacenEnMemoria` (tablas `productos`, `categorias`, `fotos`). `porNombreNormalizado` recorre la tabla. Tests: guardar/leer, búsqueda por nombre normalizado, `hayConCategoria`, eliminar.

- [ ] Rojo → verde → commit `feat(catalogo): repositorios en memoria`.

### Tarea 4: Casos de uso de productos y categorías

**Archivos:** `application/puertos.ts`, `application/productos.ts`, `application/categorias.ts`, `application/modulo.ts` (parcial) y sus specs.

Doble de prueba para Inventario (en el spec): objeto que guarda `stock` por producto, registra llamadas a `registrarStockInicial` / `retirarStock` y responde `tieneOperaciones`. Doble para ventas: `vecesVendido` que devuelve un `Map` fijo.

Tests de casos de uso (usar los datos de `catalogo.feature`):
- RN-CAT-01/02: crear duplicado activo → error; duplicado archivado → `{ tipo: 'reactivar', nombre: 'Escoba' }` y no se crea nada.
- RN-CAT-05: crear con pérdida → `{ tipo: 'confirmar', mensaje: 'Vas a perder S/ 0.50 por cada unidad' }`; con `confirmado: true` → `hecho`.
- RN-CAT-08: stock inicial `12` → se llama `registrarStockInicial('…', 12000 milésimas, S/ 2.40)`; `0` o vacío → no se llama.
- RN-CAT-08 + RN-OP-06: si `registrarStockInicial` lanza, el producto **no** queda guardado (UoW).
- RN-CAT-03: `editarProducto({ unidad })` con operaciones → error exacto.
- RN-CAT-10: `buscarProductos({ texto: 'escoba' })` no devuelve archivados; `{ archivados: true }` sí.
- RN-CAT-11: archivar con stock 4 → `confirmar('Aún quedan 4 unid. ¿Las retiramos del stock?')`; confirmado → `retirarStock` llamado y producto archivado; con stock 0 → archiva directo.
- RN-CAT-15: eliminar categoría con producto archivado → error exacto; renombrar a un nombre existente → error.
- Eventos: crear publica `ProductoCreado` **después** de confirmar; si la UoW falla no se publica nada.
- `validarNuevo`: devuelve `{ codigo: 'NOMBRE_DUPLICADO', nombreExistente: 'Lejía 1 L', … }` para `lejia 1 l`; `{ codigo: 'CANTIDAD_ENTERA', … }` para mínimo `1.5` en unidad; `null` si es válido; no guarda nada; no valida que la categoría exista.

- [ ] Rojo → verde → commit `feat(catalogo): casos de uso de productos y categorías`.

### Tarea 5: Fotos, consultable, importación y `index.ts`

**Archivos:** `application/fotos.ts`, completar `application/modulo.ts`, `infrastructure/navegador/procesador-de-fotos-canvas.ts`, `index.ts` y specs.

- `guardarFoto`: `procesadorDeFotos.reducir` → `fotos.guardar` → `producto.marcarFoto(true)` en una UoW; `quitarFoto` lo revierte.
- `consultable`: `producto`, `productos({ soloActivos })` y `actualizarPrecioCompra` (valida ≥ 0, publica `ProductoActualizado`).
- `importacion`: `validarNuevo`, `crear` (= crearProducto con `confirmado: true`, devuelve el id), `categoriaPorNombre`, `crearCategoria`.
- `index.ts` exporta: `crearModuloCatalogo`, los tipos de la sección *Interfaces*, los tres repositorios en memoria y `ProcesadorDeFotosCanvas`.

Tests: foto (con procesador falso), `actualizarPrecioCompra` publica evento, `consultable.productos({ soloActivos: true })`.

- [ ] Rojo → verde → verificación final de la rama (ver comunes) → commit `feat(catalogo): fotos, API para otros módulos e importación`.
