import { Cantidad } from '../../../shared/domain/cantidad'
import { Dinero } from '../../../shared/domain/dinero'
import { diaDe, sumarDias } from '../../../shared/domain/fecha'
import {
  hojaDeMovimientos,
  hojaDeProductos,
  hojaDeResumen,
  PLANTILLA,
  type FilaDeMovimientoParaExcel,
  type FilaDeProductoParaExcel,
  type HojaDeExcel,
} from '../domain/hojas-de-excel'
import { nombreDeArchivoExcel } from '../domain/nombres-de-archivo'
import type { ArchivoGenerado, DependenciasDeRespaldo } from './puertos'

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
/** RN-RE-01: "de los últimos 90 días" = hoy y los 89 anteriores. */
const DIAS_DE_HISTORIA = 90

/** Precio de venta (en VENTA) o costo (en el resto): lo que se multiplica por la cantidad
 * para obtener el importe de la línea. */
function importeDeLinea(precioOCosto: Dinero, cantidad: Cantidad): Dinero {
  return precioOCosto.multiplicarPor(Cantidad.deMilesimas(Math.abs(cantidad.milesimas)))
}

/** RN-RE-01: exporta el inventario, los movimientos y el resumen diario a Excel. */
export async function exportarExcel(
  deps: DependenciasDeRespaldo,
): Promise<ArchivoGenerado & { hojas: HojaDeExcel[] }> {
  const catalogo = deps.catalogo()
  const inventario = deps.inventario()
  const analisis = deps.analisis()

  const [configuracion, productos, situaciones, existencias, operaciones] = await Promise.all([
    deps.tienda().configuracion(),
    catalogo.productos(),
    analisis.situaciones(),
    inventario.existencias(),
    inventario.operaciones(),
  ])

  const estadoPorProducto = new Map(situaciones.map((s) => [s.productoId, s.estado]))
  const nombrePorProducto = new Map(productos.map((p) => [p.id, p.nombre]))

  const filasDeProductos: FilaDeProductoParaExcel[] = productos.map((p) => ({
    nombre: p.nombre,
    categoriaNombre: p.categoriaNombre,
    unidad: p.unidad,
    precioCompra: p.precioCompra,
    precioVenta: p.precioVenta,
    stock: existencias.get(p.id) ?? Cantidad.cero(),
    stockMinimo: p.stockMinimo,
    estado: estadoPorProducto.get(p.id) ?? null,
    activo: p.activo,
  }))

  const idsAnulados = new Set(
    operaciones.filter((op) => op.anulaA !== null).map((op) => op.anulaA as string),
  )
  const filasDeMovimientos: FilaDeMovimientoParaExcel[] = operaciones.flatMap((op) =>
    op.movimientos.map((movimiento) => {
      const costoUnitario = Dinero.deCentimos(movimiento.costoUnitario)
      const precioUnitario =
        movimiento.precioUnitario === null ? null : Dinero.deCentimos(movimiento.precioUnitario)
      const cantidad = Cantidad.deMilesimas(movimiento.cantidad)
      return {
        ocurridaEn: op.ocurridaEn,
        tipo: op.tipo,
        motivo: op.motivo,
        productoNombre: nombrePorProducto.get(movimiento.productoId) ?? '',
        cantidad,
        precioUnitario,
        costoUnitario,
        importe: importeDeLinea(precioUnitario ?? costoUnitario, cantidad),
        anulada: idsAnulados.has(op.id),
        nota: op.nota,
      }
    }),
  )

  const hoy = diaDe(deps.reloj.ahora())
  const desde = sumarDias(hoy, -(DIAS_DE_HISTORIA - 1))
  const dias = await analisis.resumenesDeTienda(desde, hoy)

  const hojas: HojaDeExcel[] = [
    hojaDeProductos(filasDeProductos),
    hojaDeMovimientos(filasDeMovimientos),
    hojaDeResumen(dias),
  ]
  const contenido = await deps.generadorDeExcel.generar(hojas)
  const nombre = nombreDeArchivoExcel(configuracion.nombreTienda, hoy)

  return { nombre, tipo: TIPO_XLSX, contenido, hojas }
}

/** RN-RE-07: plantilla descargable para importar productos. */
export async function descargarPlantilla(
  deps: DependenciasDeRespaldo,
): Promise<ArchivoGenerado & { hojas: HojaDeExcel[] }> {
  const hojas = [...PLANTILLA]
  const contenido = await deps.generadorDeExcel.generar(hojas)
  return { nombre: 'plantilla-de-productos.xlsx', tipo: TIPO_XLSX, contenido, hojas }
}
