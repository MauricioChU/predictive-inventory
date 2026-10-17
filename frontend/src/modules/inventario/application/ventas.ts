import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import type { DatosDeVenta } from '../domain/carrito'
import { Operacion, type LineaDeVenta } from '../domain/operacion'
import { fusionarLineas, leerCantidad, leerPrecioDeVenta } from '../domain/reglas'
import {
  datosDeProductos,
  datosDeRegistro,
  momentosDe,
  productoActivo,
  type ContextoDeInventario,
} from './contexto'

export type { DatosDeVenta, LineaPedida } from '../domain/carrito'

/** HU-OP-01: RN-OP-03..12. Guarda precio y costo vigentes por línea. */
export async function registrarVenta(
  ctx: ContextoDeInventario,
  datos: DatosDeVenta,
): Promise<{ operacionId: string }> {
  const momentos = momentosDe(ctx.reloj, datos.ocurridaEn)
  const lineas: (LineaDeVenta & { producto: ProductoResumido })[] = []
  for (const pedida of datos.lineas) {
    const producto = await productoActivo(ctx, pedida.productoId)
    lineas.push({
      producto,
      productoId: producto.id,
      cantidad: leerCantidad(pedida.cantidad, producto.unidad),
      precioUnitario:
        pedida.precioEspecial === undefined
          ? producto.precioVenta
          : leerPrecioDeVenta(pedida.precioEspecial),
      costoUnitario: producto.precioCompra,
    })
  }
  const fusionadas = fusionarLineas(lineas, (l) => l.precioUnitario)
  const venta = Operacion.venta(await datosDeRegistro(ctx, momentos, datos.nota), fusionadas)
  await ctx.libro.registrar(venta, datosDeProductos(fusionadas.map((l) => l.producto)))
  return { operacionId: venta.id }
}
