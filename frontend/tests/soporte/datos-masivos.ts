import type {
  CategoriaRegistro,
  OperacionRegistro,
  ProductoRegistro,
} from '@/shared/contratos/registros'
import { instanteLocal, sumarDias, sumarSegundos, type Dia } from '@/shared/domain/fecha'
import { normalizar } from '@/shared/domain/texto'

export interface DatosMasivos {
  categorias: CategoriaRegistro[]
  productos: ProductoRegistro[]
  operaciones: OperacionRegistro[]
  /** Movimientos (líneas) de todas las operaciones. */
  movimientos: number
}

export interface OpcionesDeDatosMasivos {
  /** El "hoy" del escenario: la historia termina el día anterior. */
  hoy: Dia
  productos?: number
  movimientos?: number
  dias?: number
  semilla?: number
}

/** Generador pseudoaleatorio determinista (LCG): los mismos datos en cada corrida. */
function crearAzar(semilla: number): (n: number) => number {
  let estado = semilla >>> 0
  return (n) => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0
    return estado % n
  }
}

function dosDigitos(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Datos realistas para RN-SIS-09 (300 productos, 50 000 movimientos en un año): cada producto
 * con su STOCK_INICIAL al principio, ventas de 1 a 3 líneas repartidas entre las 08:00 y las
 * 20:00 de cada día, y una llegada de mercadería cuando a un producto le quedan menos de 5
 * unidades. El stock nunca queda negativo. Son registros del libro (como los de una copia):
 * se cargan con `AlmacenDeRespaldo.reemplazarTodo` y las proyecciones se reconstruyen.
 */
export function generarDatosMasivos(opciones: OpcionesDeDatosMasivos): DatosMasivos {
  const totalProductos = opciones.productos ?? 300
  const totalMovimientos = opciones.movimientos ?? 50_000
  const dias = opciones.dias ?? 365
  const azar = crearAzar(opciones.semilla ?? 20261015)
  const inicio = sumarDias(opciones.hoy, -dias)
  const creadoEn = instanteLocal(`${inicio} 07:00`)

  const categorias: CategoriaRegistro[] = Array.from({ length: 10 }, (_, i) => {
    const nombre = `Categoría ${i + 1}`
    return { id: `cat-${i + 1}`, nombre, nombreNormalizado: normalizar(nombre) }
  })

  const productos: ProductoRegistro[] = Array.from({ length: totalProductos }, (_, i) => {
    const nombre = `Producto ${String(i + 1).padStart(3, '0')}`
    const compra = 100 + azar(1900)
    return {
      id: `p-${String(i + 1).padStart(3, '0')}`,
      nombre,
      nombreNormalizado: normalizar(nombre),
      categoriaId: `cat-${(i % 10) + 1}`,
      unidad: i % 5 === 0 ? 'KILO' : 'UNIDAD',
      precioCompra: compra,
      precioVenta: Math.round(compra * 1.4),
      stockMinimo: 3000,
      tieneFoto: false,
      estado: 'ACTIVO',
      creadoEn,
      actualizadoEn: creadoEn,
    }
  })

  const operaciones: OperacionRegistro[] = []
  let movimientos = 0
  const stock = new Map<string, number>()
  let siguienteId = 1

  function agregar(
    tipo: OperacionRegistro['tipo'],
    instante: string,
    lineas: { producto: ProductoRegistro; cantidad: number }[],
  ): void {
    const id = `op-${String(siguienteId++).padStart(6, '0')}`
    operaciones.push({
      id,
      tipo,
      movimientos: lineas.map(({ producto, cantidad }) => ({
        productoId: producto.id,
        cantidad,
        costoUnitario: producto.precioCompra,
        precioUnitario: tipo === 'VENTA' ? producto.precioVenta : null,
      })),
      productoIds: lineas.map((l) => l.producto.id),
      ocurridaEn: instante,
      registradaEn: instante,
      motivo: null,
      nota: null,
      anulaA: null,
      dispositivoId: 'dispositivo-1',
    })
    movimientos += lineas.length
    for (const { producto, cantidad } of lineas) {
      stock.set(producto.id, (stock.get(producto.id) ?? 0) + cantidad)
    }
  }

  productos.forEach((producto, i) => {
    const minuto = i % 60
    const instante = instanteLocal(`${inicio} 07:${dosDigitos(minuto)}`)
    agregar('STOCK_INICIAL', instante, [{ producto, cantidad: (60 + azar(140)) * 1000 }])
  })

  const porDia = Math.ceil((totalMovimientos - movimientos) / (dias - 1))
  for (let d = 1; d < dias && movimientos < totalMovimientos; d += 1) {
    const dia = sumarDias(inicio, d)
    const abre = instanteLocal(`${dia} 08:00`)
    let delDia = 0
    let segundo = 0
    while (delDia < porDia && movimientos < totalMovimientos) {
      // Una operación cada ~40 s desde que abre (unas 60 al día: no pasa de las 20:00).
      segundo += 1 + azar(80)
      const instante = sumarSegundos(abre, segundo)

      const cuantas = Math.min(1 + azar(3), totalMovimientos - movimientos)
      const elegidos = new Set<ProductoRegistro>()
      while (elegidos.size < cuantas) elegidos.add(productos[azar(productos.length)]!)

      const reponer = [...elegidos].filter((p) => (stock.get(p.id) ?? 0) < 5000)
      if (reponer.length > 0) {
        agregar(
          'INGRESO',
          instante,
          reponer.map((producto) => ({ producto, cantidad: 50_000 })),
        )
        delDia += reponer.length
        continue
      }
      const lineas = [...elegidos].map((producto) => ({
        producto,
        cantidad: producto.unidad === 'KILO' ? -(500 * (1 + azar(4))) : -1000 * (1 + azar(2)),
      }))
      agregar('VENTA', instante, lineas)
      delDia += lineas.length
    }
  }

  return { categorias, productos, operaciones, movimientos }
}
