import { Cantidad, type Unidad } from '@/shared/domain/cantidad'
import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import { ConteoGuiado, ordenarParaConteo } from '../domain/conteo-guiado'
import { leerContado } from '../domain/reglas'
import type { ContextoDeInventario } from './contexto'
import { contarEn } from './mermas-y-ajustes'

export interface EstadoDelConteo {
  producto: {
    id: string
    nombre: string
    unidad: Unidad
    stock: Cantidad
    tieneFoto: boolean
  } | null
  /** "Llevas 1 de 3". */
  progreso: string
  terminado: boolean
  /** Solo al terminar (RN-OP-21). */
  resumen: string[] | null
}

type Productos = ReadonlyMap<string, ProductoResumido>

async function productosPorId(ctx: ContextoDeInventario): Promise<Productos> {
  return new Map((await ctx.catalogo().productos()).map((p) => [p.id, p]))
}

/** Solo se cuentan productos activos: los archivados durante el conteo se saltan solos. */
function seguirConContables(
  ctx: ContextoDeInventario,
  conteo: ConteoGuiado,
  productos: Productos,
): ConteoGuiado {
  return conteo.omitirNoContables((id) => productos.get(id)?.activo === true, ctx.reloj.ahora())
}

async function estadoDe(
  ctx: ContextoDeInventario,
  conteo: ConteoGuiado,
  productos: Productos,
): Promise<EstadoDelConteo> {
  const id = conteo.productoActual
  const producto = id === null ? undefined : productos.get(id)
  return {
    producto: producto
      ? {
          id: producto.id,
          nombre: producto.nombre,
          unidad: producto.unidad,
          stock: await ctx.existencias.obtener(producto.id),
          tieneFoto: producto.tieneFoto,
        }
      : null,
    progreso: conteo.progreso(),
    terminado: conteo.terminado,
    resumen: conteo.resumen((productoId) => productos.get(productoId)?.nombre ?? productoId),
  }
}

async function guardar(ctx: ContextoDeInventario, conteo: ConteoGuiado): Promise<void> {
  await ctx.uow.ejecutar(() => ctx.conteo.guardar(conteo.aRegistro()))
}

async function enCurso(
  ctx: ContextoDeInventario,
): Promise<{ conteo: ConteoGuiado; productos: Productos }> {
  const registro = await ctx.conteo.obtener()
  if (!registro || registro.terminadoEn !== null) {
    throw new Error('No hay un conteo guiado en curso')
  }
  const productos = await productosPorId(ctx)
  return {
    conteo: seguirConContables(ctx, ConteoGuiado.desdeRegistro(registro), productos),
    productos,
  }
}

/** RN-OP-21 ("Contar todo"): empieza un conteo nuevo con los productos activos. */
export async function iniciarConteoGuiado(ctx: ContextoDeInventario): Promise<EstadoDelConteo> {
  const productos = await productosPorId(ctx)
  const activos = [...productos.values()].filter((p) => p.activo)
  const conteo = ConteoGuiado.iniciar(ordenarParaConteo(activos), ctx.reloj.ahora())
  await guardar(ctx, conteo)
  return estadoDe(ctx, conteo, productos)
}

/** RN-OP-21 ("Seguir después"): dónde quedó el conteo, o null si no hay uno en curso. */
export async function conteoActual(ctx: ContextoDeInventario): Promise<EstadoDelConteo | null> {
  const registro = await ctx.conteo.obtener()
  if (!registro || registro.terminadoEn !== null) return null
  const productos = await productosPorId(ctx)
  const conteo = seguirConContables(ctx, ConteoGuiado.desdeRegistro(registro), productos)
  return estadoDe(ctx, conteo, productos)
}

/**
 * RN-OP-21: "¿Cuántos hay?" del producto actual. Se registra AL MOMENTO como en RN-OP-16, en
 * la misma transacción que el avance del conteo, con su diferencia y su valor al costo.
 */
export async function responderConteo(
  ctx: ContextoDeInventario,
  contado: string,
): Promise<EstadoDelConteo> {
  const { conteo, productos } = await enCurso(ctx)
  const id = conteo.productoActual
  const producto = id === null ? undefined : productos.get(id)
  if (!producto) {
    await guardar(ctx, conteo)
    return estadoDe(ctx, conteo, productos)
  }
  const cantidad = leerContado(contado, producto.unidad)
  const siguiente = await ctx.libro.enTransaccion(async (escritura) => {
    const respuesta = await contarEn(ctx, escritura, producto, cantidad)
    const diferencia = respuesta.tipo === 'ajustado' ? respuesta.diferencia : Cantidad.cero()
    const valor = producto.precioCompra.multiplicarPor(diferencia)
    const avanzado = seguirConContables(
      ctx,
      conteo.contar(diferencia, valor, ctx.reloj.ahora()),
      productos,
    )
    await ctx.conteo.guardar(avanzado.aRegistro())
    return avanzado
  })
  return estadoDe(ctx, siguiente, productos)
}

/** RN-OP-21: "Saltar": queda en "Te faltó contar". */
export async function saltarEnConteo(ctx: ContextoDeInventario): Promise<EstadoDelConteo> {
  const { conteo, productos } = await enCurso(ctx)
  const siguiente = conteo.terminado
    ? conteo
    : seguirConContables(ctx, conteo.saltar(ctx.reloj.ahora()), productos)
  await guardar(ctx, siguiente)
  return estadoDe(ctx, siguiente, productos)
}
