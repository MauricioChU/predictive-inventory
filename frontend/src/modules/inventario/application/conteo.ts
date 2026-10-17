import { Cantidad, type Unidad } from '@/shared/domain/cantidad'
import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import { ConteoGuiado, ordenarParaConteo } from '../domain/conteo-guiado'
import { leerContado } from '../domain/reglas'
import type { ContextoDeInventario } from './contexto'
import type { ServicioDeDeshacer } from './deshacer'
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
  /** El mismo avance en números (BarraDeProgreso de "Contar todo"). */
  avance: { hechos: number; total: number }
  terminado: boolean
  /** Solo al terminar (RN-OP-21). */
  resumen: string[] | null
}

/** Lo que devuelve "¿Cuántos hay?": el estado nuevo y el AJUSTE que registró, si hubo. */
export interface RespuestaDelConteoGuiado extends EstadoDelConteo {
  /** El AJUSTE registrado por esta respuesta (para Deshacer), o null si el stock ya estaba bien. */
  operacionId: string | null
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
    avance: conteo.avance(),
    terminado: conteo.terminado,
    resumen: conteo.resumen((productoId) => productos.get(productoId)?.nombre ?? productoId),
  }
}

async function guardar(ctx: ContextoDeInventario, conteo: ConteoGuiado): Promise<void> {
  await ctx.uow.ejecutar(() => ctx.conteo.guardar(conteo.aRegistro()))
}

/**
 * El conteo guardado, leído DENTRO de la transacción que lo va a cambiar: así dos toques
 * seguidos (doble "Siguiente" o un "Saltar" rápido) se aplican uno después del otro y ninguno
 * pisa al otro. Un conteo ya terminado se devuelve tal cual: un toque de más no falla.
 */
async function cargarEnCurso(
  ctx: ContextoDeInventario,
  productos: Productos,
): Promise<ConteoGuiado> {
  const registro = await ctx.conteo.obtener()
  if (!registro) throw new Error('No hay un conteo guiado en curso')
  return seguirConContables(ctx, ConteoGuiado.desdeRegistro(registro), productos)
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
 * la misma transacción que lee y avanza el conteo, con su diferencia y su valor al costo.
 */
export async function responderConteo(
  ctx: ContextoDeInventario,
  contado: string,
): Promise<RespuestaDelConteoGuiado> {
  const productos = await productosPorId(ctx)
  let operacionId: string | null = null
  const siguiente = await ctx.libro.enTransaccion(async (escritura) => {
    const conteo = await cargarEnCurso(ctx, productos)
    const id = conteo.productoActual
    const producto = id === null ? undefined : productos.get(id)
    if (!producto) {
      await ctx.conteo.guardar(conteo.aRegistro())
      return conteo
    }
    const cantidad = leerContado(contado, producto.unidad)
    const respuesta = await contarEn(ctx, escritura, producto, cantidad)
    operacionId = respuesta.tipo === 'ajustado' ? respuesta.operacionId : null
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
  return { operacionId, ...(await estadoDe(ctx, siguiente, productos)) }
}

/**
 * RN-OP-18 en el conteo guiado (plan 12): deshacer la respuesta que registró el AJUSTE
 * `operacionId`. En UNA unidad de trabajo: lo anula con el Deshacer del módulo (que exige que
 * siga siendo la operación ofrecida y dentro del tiempo) y el producto deja de contar en el
 * resumen y pasa a "Te faltó contar". Si el Deshacer se rechaza, no cambia nada.
 */
export async function deshacerRespuestaDeConteo(
  ctx: ContextoDeInventario,
  deshacer: ServicioDeDeshacer,
  operacionId: string,
): Promise<EstadoDelConteo> {
  const productos = await productosPorId(ctx)
  const siguiente = await ctx.uow.ejecutar(async () => {
    const ajuste = await ctx.operaciones.porId(operacionId)
    if (ajuste?.tipo !== 'AJUSTE') throw new Error(`${operacionId} no es un conteo`)
    await deshacer.deshacer(operacionId)
    const conteo = await cargarEnCurso(ctx, productos)
    const productoId = ajuste.movimientos[0]?.productoId
    const actualizado = productoId ? conteo.deshacerRespuesta(productoId) : conteo
    await ctx.conteo.guardar(actualizado.aRegistro())
    return actualizado
  })
  return estadoDe(ctx, siguiente, productos)
}

/** RN-OP-21: "Saltar": queda en "Te faltó contar". */
export async function saltarEnConteo(ctx: ContextoDeInventario): Promise<EstadoDelConteo> {
  const productos = await productosPorId(ctx)
  const siguiente = await ctx.uow.ejecutar(async () => {
    const conteo = await cargarEnCurso(ctx, productos)
    const avanzado = conteo.terminado
      ? conteo
      : seguirConContables(ctx, conteo.saltar(ctx.reloj.ahora()), productos)
    await ctx.conteo.guardar(avanzado.aRegistro())
    return avanzado
  })
  return estadoDe(ctx, siguiente, productos)
}
