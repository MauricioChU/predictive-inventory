import type { Instante } from '@/shared/domain/fecha'
import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import type { LineaPedida } from '../domain/carrito'
import { mensajeCambioDePrecio, mensajeDeSobrecompra } from '../domain/mensajes'
import { Operacion, type LineaConCosto } from '../domain/operacion'
import { fusionarLineas, leerCantidad, leerCosto, validarCantidad } from '../domain/reglas'
import {
  datosDeProductos,
  datosDeRegistro,
  momentosDe,
  productoActivo,
  type ContextoDeInventario,
} from './contexto'

export interface DatosDeIngreso {
  lineas: (LineaPedida & { costo: string })[]
  ocurridaEn?: Instante
  /** true = el usuario tocó "Registrar igual" (RN-OP-20). */
  confirmarSobrecompra?: boolean
  /** undefined = aún no se preguntó; true/false = respuesta del usuario (RN-OP-14). */
  actualizarPreciosDeCompra?: boolean
}

export type RespuestaDeIngreso =
  | { tipo: 'hecho'; operacionId: string }
  | { tipo: 'aviso-sobrecompra'; avisos: { productoId: string; mensaje: string }[] }
  | { tipo: 'confirmar-precios'; cambios: { productoId: string; mensaje: string }[] }

/** RN-OP-20: el aviso no bloquea. */
export const OPCIONES_DE_SOBRECOMPRA = ['Registrar igual', 'Cambiar cantidad'] as const

type LineaDeIngreso = LineaConCosto & { producto: ProductoResumido }

/**
 * HU-OP-03. Valida todo; luego, si no se confirmó, avisa la sobrecompra (RN-OP-20); si algún
 * costo cambió y aún no se preguntó, pide confirmar el precio de compra (RN-OP-14). Solo
 * entonces registra y, si el usuario aceptó, actualiza los precios de compra en la MISMA
 * transacción.
 */
export async function registrarIngreso(
  ctx: ContextoDeInventario,
  datos: DatosDeIngreso,
): Promise<RespuestaDeIngreso> {
  const momentos = momentosDe(ctx.reloj, datos.ocurridaEn)
  const pedidas: LineaDeIngreso[] = []
  for (const pedida of datos.lineas) {
    const producto = await productoActivo(ctx, pedida.productoId)
    pedidas.push({
      producto,
      productoId: producto.id,
      cantidad: leerCantidad(pedida.cantidad, producto.unidad),
      costoUnitario: leerCosto(pedida.costo),
    })
  }
  const lineas = fusionarLineas(pedidas)
  for (const linea of lineas) validarCantidad(linea.cantidad)

  if (datos.confirmarSobrecompra !== true) {
    const avisos = await avisosDeSobrecompra(ctx, lineas)
    if (avisos.length > 0) return { tipo: 'aviso-sobrecompra', avisos }
  }

  const cambios = lineas.filter((l) => !l.costoUnitario.igualA(l.producto.precioCompra))
  if (cambios.length > 0 && datos.actualizarPreciosDeCompra === undefined) {
    return {
      tipo: 'confirmar-precios',
      cambios: cambios.map((l) => ({
        productoId: l.productoId,
        mensaje: mensajeCambioDePrecio(l.costoUnitario, l.producto.precioVenta, l.producto.unidad),
      })),
    }
  }

  const ingreso = Operacion.ingreso(await datosDeRegistro(ctx, momentos), lineas)
  await ctx.libro.enTransaccion(async (escritura) => {
    await escritura.registrar(ingreso, datosDeProductos(lineas.map((l) => l.producto)))
    if (datos.actualizarPreciosDeCompra !== true) return
    for (const cambio of cambios) {
      await ctx.catalogo().actualizarPrecioCompra(cambio.productoId, cambio.costoUnitario)
    }
  })
  return { tipo: 'hecho', operacionId: ingreso.id }
}

async function avisosDeSobrecompra(
  ctx: ContextoDeInventario,
  lineas: readonly LineaDeIngreso[],
): Promise<{ productoId: string; mensaje: string }[]> {
  const { diasMaximosDeCompra } = await ctx.tienda().configuracion()
  const avisos: { productoId: string; mensaje: string }[] = []
  for (const linea of lineas) {
    const situacion = await ctx.analisis().situacion(linea.productoId)
    const mensaje =
      situacion &&
      mensajeDeSobrecompra(linea.producto, situacion, linea.cantidad, diasMaximosDeCompra)
    if (mensaje) avisos.push({ productoId: linea.productoId, mensaje })
  }
  return avisos
}
