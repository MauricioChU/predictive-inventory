import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { diaDe, sumarDias } from '@/shared/domain/fecha'
import { ErrorDeDominio, esErrorDeDominio } from '@/shared/domain/errores'
import { normalizar } from '@/shared/domain/texto'
import { confirmar, hecho, ofrecerReactivar, type Respuesta } from '@/shared/application/respuesta'
import type { DatosDeProductoNuevo, ErrorDeValidacion } from '@/shared/contratos/entre-modulos'
import type { ProductoRegistro } from '@/shared/contratos/registros'
import { coincide, ordenarResultados } from '../domain/busqueda'
import { mensajePerdida, mensajeRetiro } from '../domain/mensajes'
import { Producto } from '../domain/producto'
import {
  leerNombre,
  leerPrecioCompra,
  leerPrecioVenta,
  leerStockInicial,
  leerStockMinimo,
} from '../domain/validaciones'
import type { DatosDeEdicion, DependenciasDeCatalogo, ProductoVista } from './modulo'
import type { RepositorioDeProductos } from './puertos'

async function obtenerRegistro(
  productos: RepositorioDeProductos,
  productoId: string,
): Promise<ProductoRegistro> {
  const registro = await productos.porId(productoId)
  if (!registro) throw new ErrorDeDominio('PRODUCTO_NO_ENCONTRADO', 'No encontramos ese producto')
  return registro
}

function aProductoVista(
  registro: ProductoRegistro,
  categoriaNombre: string,
  stock: Cantidad,
): ProductoVista {
  const precioCompra = Dinero.deCentimos(registro.precioCompra)
  const precioVenta = Dinero.deCentimos(registro.precioVenta)
  return {
    id: registro.id,
    nombre: registro.nombre,
    categoriaId: registro.categoriaId,
    categoriaNombre,
    unidad: registro.unidad,
    precioCompra,
    precioVenta,
    gananciaPorUnidad: precioVenta.restar(precioCompra),
    stockMinimo: Cantidad.deMilesimas(registro.stockMinimo),
    stock,
    activo: registro.estado === 'ACTIVO',
    tieneFoto: registro.tieneFoto,
  }
}

/**
 * RN-CAT-01/02/04/05/06/08: valida en orden (nombre, unicidad, categoría, precio de compra,
 * precio de venta, stock mínimo, stock inicial) y, al confirmar, guarda el producto y registra
 * el stock inicial en la MISMA unidad de trabajo (RN-OP-06): si falla, el producto no queda
 * guardado. Publica `ProductoCreado` después de confirmar la UoW.
 */
export async function crearProducto(
  datos: DatosDeProductoNuevo & { confirmado?: boolean },
  deps: DependenciasDeCatalogo,
): Promise<Respuesta<{ productoId: string }>> {
  const nombre = leerNombre(datos.nombre)
  const normalizado = normalizar(nombre)
  const existente = await deps.productos.porNombreNormalizado(normalizado)
  if (existente) {
    if (existente.estado === 'ACTIVO') {
      throw new ErrorDeDominio('NOMBRE_DUPLICADO', 'Ya existe un producto con ese nombre')
    }
    // RN-CAT-02: no crea nada nuevo, ofrece reactivar el archivado.
    return ofrecerReactivar(existente.id, existente.nombre)
  }

  const categoria = await deps.categorias.porId(datos.categoriaId)
  if (!categoria) throw new ErrorDeDominio('CATEGORIA_INEXISTENTE', 'Elige una categoría')

  const precioCompra = leerPrecioCompra(datos.precioCompra)
  const precioVenta = leerPrecioVenta(datos.precioVenta)
  const stockMinimo = leerStockMinimo(datos.stockMinimo, datos.unidad)
  const stockInicial = leerStockInicial(datos.stockInicial, datos.unidad)

  const perdida = precioVenta.mayorQue(precioCompra) ? null : precioCompra.restar(precioVenta)
  if (perdida !== null && !datos.confirmado) {
    return confirmar(mensajePerdida(perdida, datos.unidad))
  }

  const id = deps.ids.nuevo()
  const ahora = deps.reloj.ahora()
  const producto = Producto.crear({
    id,
    nombre,
    categoriaId: datos.categoriaId,
    unidad: datos.unidad,
    precioCompra,
    precioVenta,
    stockMinimo,
    ahora,
  })

  await deps.uow.ejecutar(async () => {
    await deps.productos.guardar(producto.aRegistro())
    if (stockInicial.esPositiva()) {
      await deps.inventario().registrarStockInicial(id, stockInicial, precioCompra)
    }
  })

  await deps.bus.publicar({ tipo: 'ProductoCreado', productoId: id })
  return hecho({ productoId: id })
}

/**
 * Edita el nombre, categoría, unidad, precios y/o stock mínimo. RN-CAT-03: la unidad no
 * cambia si el producto ya tiene operaciones. RN-CAT-05: un precio con pérdida pide
 * confirmar antes de guardar nada.
 */
export async function editarProducto(
  datos: DatosDeEdicion,
  deps: DependenciasDeCatalogo,
): Promise<Respuesta<void>> {
  const registro = await obtenerRegistro(deps.productos, datos.productoId)
  const producto = Producto.desdeRegistro(registro)
  const ahora = deps.reloj.ahora()

  if (datos.nombre !== undefined) {
    const nombre = leerNombre(datos.nombre)
    const normalizado = normalizar(nombre)
    if (normalizado !== producto.nombreNormalizado) {
      const existente = await deps.productos.porNombreNormalizado(normalizado)
      if (existente && existente.id !== producto.id) {
        throw new ErrorDeDominio('NOMBRE_DUPLICADO', 'Ya existe un producto con ese nombre')
      }
    }
    producto.renombrar(nombre, ahora)
  }

  if (datos.categoriaId !== undefined) {
    const categoria = await deps.categorias.porId(datos.categoriaId)
    if (!categoria) throw new ErrorDeDominio('CATEGORIA_INEXISTENTE', 'Elige una categoría')
    producto.cambiarCategoria(datos.categoriaId, ahora)
  }

  if (datos.unidad !== undefined && datos.unidad !== producto.unidad) {
    const tieneOperaciones = await deps.inventario().tieneOperaciones(producto.id)
    producto.cambiarUnidad(datos.unidad, tieneOperaciones, ahora)
  }

  if (datos.stockMinimo !== undefined) {
    const minimo = leerStockMinimo(datos.stockMinimo, producto.unidad)
    producto.cambiarStockMinimo(minimo, ahora)
  }

  if (datos.precioCompra !== undefined || datos.precioVenta !== undefined) {
    const compra =
      datos.precioCompra !== undefined
        ? leerPrecioCompra(datos.precioCompra)
        : producto.precioCompra
    const venta =
      datos.precioVenta !== undefined ? leerPrecioVenta(datos.precioVenta) : producto.precioVenta
    const perdida = venta.mayorQue(compra) ? null : compra.restar(venta)
    if (perdida !== null && !datos.confirmado) {
      return confirmar(mensajePerdida(perdida, producto.unidad))
    }
    producto.cambiarPrecios(compra, venta, ahora)
  }

  await deps.uow.ejecutar(async () => {
    await deps.productos.guardar(producto.aRegistro())
  })
  await deps.bus.publicar({ tipo: 'ProductoActualizado', productoId: producto.id })
  return hecho(undefined)
}

/**
 * RN-CAT-11: para archivar el stock debe ser 0; si no, ofrece retirarlo (AJUSTE) y archivar
 * en el mismo paso. Publica `ProductoArchivado` tras confirmar la UoW.
 */
export async function archivarProducto(
  datos: { productoId: string; confirmado?: boolean },
  deps: DependenciasDeCatalogo,
): Promise<Respuesta<void>> {
  const registro = await obtenerRegistro(deps.productos, datos.productoId)
  const producto = Producto.desdeRegistro(registro)
  const stock = await deps.inventario().stockDe(producto.id)

  if (stock.esPositiva() && !datos.confirmado) {
    return confirmar(mensajeRetiro(stock, producto.unidad))
  }

  const ahora = deps.reloj.ahora()
  await deps.uow.ejecutar(async () => {
    if (stock.esPositiva()) {
      await deps.inventario().retirarStock(producto.id)
    }
    producto.archivar(ahora)
    await deps.productos.guardar(producto.aRegistro())
  })

  await deps.bus.publicar({ tipo: 'ProductoArchivado', productoId: producto.id })
  return hecho(undefined)
}

/** Reactiva un producto archivado (RN-CAT-02). Publica `ProductoReactivado`. */
export async function reactivarProducto(
  productoId: string,
  deps: DependenciasDeCatalogo,
): Promise<void> {
  const registro = await obtenerRegistro(deps.productos, productoId)
  const producto = Producto.desdeRegistro(registro)
  const ahora = deps.reloj.ahora()
  producto.reactivar(ahora)

  await deps.uow.ejecutar(async () => {
    await deps.productos.guardar(producto.aRegistro())
  })
  await deps.bus.publicar({ tipo: 'ProductoReactivado', productoId })
}

export async function obtenerProducto(
  productoId: string,
  deps: DependenciasDeCatalogo,
): Promise<ProductoVista | null> {
  const registro = await deps.productos.porId(productoId)
  if (!registro) return null
  const categoria = await deps.categorias.porId(registro.categoriaId)
  const stock = await deps.inventario().stockDe(productoId)
  return aProductoVista(registro, categoria?.nombre ?? '', stock)
}

/**
 * RN-CAT-10/12: solo productos activos, salvo `archivados: true`. Encuentra por todas las
 * palabras del texto (sin tildes, en cualquier orden) y ordena por veces vendido en los
 * últimos 30 días (hoy inclusive), luego por nombre.
 */
export async function buscarProductos(
  filtro: { texto: string; archivados?: boolean },
  deps: DependenciasDeCatalogo,
): Promise<ProductoVista[]> {
  const estadoBuscado = filtro.archivados ? 'ARCHIVADO' : 'ACTIVO'
  const todos = await deps.productos.todos()
  const coincidentes = todos.filter(
    (p) => p.estado === estadoBuscado && coincide(p.nombreNormalizado, filtro.texto),
  )

  const hoy = diaDe(deps.reloj.ahora())
  const desde = sumarDias(hoy, -29)
  const vecesVendido = await deps.ventas().vecesVendido(desde, hoy)
  const ordenados = ordenarResultados(coincidentes, vecesVendido)

  const categorias = await deps.categorias.todas()
  const nombrePorCategoria = new Map(categorias.map((c) => [c.id, c.nombre]))
  const existencias = await deps.inventario().existencias()

  return ordenados.map((p) =>
    aProductoVista(
      p,
      nombrePorCategoria.get(p.categoriaId) ?? '',
      existencias.get(p.id) ?? Cantidad.cero(),
    ),
  )
}

/**
 * RN-OP-14: Inventario la usa al aceptar el nuevo costo de un ingreso. Solo actualiza el
 * precio de compra (el de venta no cambia) y publica `ProductoActualizado`.
 */
export async function actualizarPrecioCompra(
  productoId: string,
  precio: Dinero,
  deps: DependenciasDeCatalogo,
): Promise<void> {
  if (precio.esNegativo()) {
    throw new ErrorDeDominio('PRECIO_COMPRA_NEGATIVO', 'El precio de compra no puede ser negativo')
  }
  const registro = await obtenerRegistro(deps.productos, productoId)
  const producto = Producto.desdeRegistro(registro)
  const ahora = deps.reloj.ahora()
  producto.cambiarPrecios(precio, producto.precioVenta, ahora)

  await deps.uow.ejecutar(async () => {
    await deps.productos.guardar(producto.aRegistro())
  })
  await deps.bus.publicar({ tipo: 'ProductoActualizado', productoId })
}

function leerOError<T>(fn: () => T): { valor: T } | { error: ErrorDeValidacion } {
  try {
    return { valor: fn() }
  } catch (error) {
    if (esErrorDeDominio(error)) return { error: { codigo: error.codigo, mensaje: error.message } }
    throw error
  }
}

/**
 * Para importación (RN-RE-07/08): el primer error de validación de formato/unicidad, o null
 * si es válido. No guarda nada ni valida que la categoría exista.
 */
export async function validarNuevo(
  datos: DatosDeProductoNuevo,
  productos: RepositorioDeProductos,
): Promise<ErrorDeValidacion | null> {
  const nombreLeido = leerOError(() => leerNombre(datos.nombre))
  if ('error' in nombreLeido) return nombreLeido.error

  const normalizado = normalizar(nombreLeido.valor)
  const existente = await productos.porNombreNormalizado(normalizado)
  if (existente) {
    return {
      codigo: 'NOMBRE_DUPLICADO',
      mensaje: 'Ya existe un producto con ese nombre',
      nombreExistente: existente.nombre,
    }
  }

  const compraLeida = leerOError(() => leerPrecioCompra(datos.precioCompra))
  if ('error' in compraLeida) return compraLeida.error

  const ventaLeida = leerOError(() => leerPrecioVenta(datos.precioVenta))
  if ('error' in ventaLeida) return ventaLeida.error

  const minimoLeido = leerOError(() => leerStockMinimo(datos.stockMinimo, datos.unidad))
  if ('error' in minimoLeido) return minimoLeido.error

  const inicialLeido = leerOError(() => leerStockInicial(datos.stockInicial, datos.unidad))
  if ('error' in inicialLeido) return inicialLeido.error

  return null
}
