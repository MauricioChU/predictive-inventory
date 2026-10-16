import type { Page } from '@playwright/test'
import { abrir } from './navegacion'

/**
 * Plan 13: historia de demostración para la Torre de control.
 *
 * Ocho semanas de una bodega de productos de limpieza, armadas SOLO con los casos de uso reales
 * (`window.__aplicacion`) y el reloj de Playwright: se instala el reloj el primer día, se crean
 * los productos con su stock inicial (su primer movimiento queda ese día) y, día por día, se
 * mueve el reloj (`clock.setSystemTime`) y se registran las ventas de ese día. Al final el reloj
 * queda en "hoy" (jueves 15/10/2026, 18:00 en Lima). Ningún atajo a los repositorios.
 *
 * Lo que sale (a propósito):
 * - Sábado es el mejor día (RN-AN-13) y la última semana se vendió más Lejía (RN-AN-12).
 * - Bolsas se agota a las tres semanas; Carbón, Lavavajillas y Cera roja quedan con poco.
 * - Cera roja se vende por debajo de lo que cuesta (RN-AN-10).
 * - Escoba (vendida una sola vez, hace 53 días) y Ambientador (nunca vendido) quedan parados.
 * - Una merma y un conteo con diferencia en la última semana, y ventas hoy.
 */

/** Primer día de la historia: jueves 20/08/2026 (56 días completos antes de hoy). */
const PRIMER_DIA = '2026-08-20'
export const DIAS_DE_HISTORIA = 56
/** "Hoy" de la demostración. */
export const HOY_DE_DEMOSTRACION = '2026-10-15'
export const NOMBRE_DE_LA_TIENDA = 'Bodega Rosita'

/** Instante de un día y hora de Lima (UTC−5, sin horario de verano). */
export function enLima(dia: string, hora: string): Date {
  return new Date(`${dia}T${hora}:00-05:00`)
}

function sumarDias(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}

/** 1 = lunes … 7 = domingo. */
function diaDeLaSemana(dia: string): number {
  const domingoEsCero = new Date(`${dia}T00:00:00Z`).getUTCDay()
  return domingoEsCero === 0 ? 7 : domingoEsCero
}

type Unidad = 'UNIDAD' | 'KILO' | 'LITRO'

interface ProductoDeDemostracion {
  nombre: string
  categoria: string
  unidad: Unidad
  compra: string
  venta: string
  minimo: string
  stockInicial: number
  /** Cuánto se vende ese día (1 = lunes … 7 = domingo); `semana` 0 es la primera. */
  vendeEl: (diaSemana: number, semana: number) => number
}

const ULTIMA_SEMANA = 7

export const PRODUCTOS_DE_DEMOSTRACION: readonly ProductoDeDemostracion[] = [
  {
    nombre: 'Lejía Tradicional 1 L',
    categoria: 'Lejías y desinfectantes',
    unidad: 'UNIDAD',
    compra: '2.40',
    venta: '3.50',
    minimo: '3',
    stockInicial: 160,
    vendeEl: (d, semana) =>
      d === 6 ? 4 : d === 7 ? 1 : semana === ULTIMA_SEMANA && d !== 4 ? 3 : 2,
  },
  {
    nombre: 'Detergente Bolívar 900 g',
    categoria: 'Detergentes y jabones',
    unidad: 'UNIDAD',
    compra: '6.20',
    venta: '8.50',
    minimo: '3',
    stockInicial: 90,
    vendeEl: (d) => (d === 6 ? 3 : d === 7 ? 0 : 1),
  },
  {
    nombre: 'Jabón Bolívar',
    categoria: 'Detergentes y jabones',
    unidad: 'UNIDAD',
    compra: '1.20',
    venta: '2.00',
    minimo: '4',
    stockInicial: 40,
    vendeEl: (d) => ([1, 3, 5, 6].includes(d) ? 1 : 0),
  },
  {
    nombre: 'Carbón',
    categoria: 'Carbón y combustibles',
    unidad: 'KILO',
    compra: '2.75',
    venta: '4.00',
    minimo: '3',
    stockInicial: 45,
    vendeEl: (d) => (d >= 6 ? 1.5 : 0.5),
  },
  {
    nombre: 'Lavavajillas Ayudín 500 g',
    categoria: 'Lavavajillas',
    unidad: 'UNIDAD',
    compra: '3.10',
    venta: '4.50',
    minimo: '3',
    stockInicial: 27,
    vendeEl: (d) => ([2, 4, 6].includes(d) ? 1 : 0),
  },
  {
    nombre: 'Papel higiénico x4',
    categoria: 'Papel y descartables',
    unidad: 'UNIDAD',
    compra: '3.50',
    venta: '5.00',
    minimo: '4',
    stockInicial: 70,
    vendeEl: () => 1,
  },
  {
    nombre: 'Bolsas de basura x10',
    categoria: 'Bolsas',
    unidad: 'UNIDAD',
    compra: '1.50',
    venta: '2.50',
    minimo: '5',
    stockInicial: 20,
    vendeEl: () => 1,
  },
  {
    nombre: 'Cera roja 1 L',
    categoria: 'Limpiadores y ceras',
    unidad: 'UNIDAD',
    compra: '5.00',
    venta: '4.50',
    minimo: '2',
    stockInicial: 10,
    vendeEl: (d) => (d === 5 ? 1 : 0),
  },
  {
    nombre: 'Escoba de paja',
    categoria: 'Escobas, trapeadores y accesorios',
    unidad: 'UNIDAD',
    compra: '6.00',
    venta: '9.00',
    minimo: '1',
    stockInicial: 6,
    vendeEl: (d, semana) => (semana === 0 && d === 7 ? 1 : 0),
  },
  {
    nombre: 'Ambientador Glade',
    categoria: 'Ambientadores e insecticidas',
    unidad: 'UNIDAD',
    compra: '8.00',
    venta: '12.00',
    minimo: '1',
    stockInicial: 4,
    vendeEl: () => 0,
  },
]

/** Lo que el generador usa de la aplicación real (src/app/ganchos-de-prueba.ts). */
interface AplicacionEnLaPagina {
  tienda: {
    obtenerConfiguracion(): Promise<{ tamanoDeLetra: string }>
    completarPrimeraVez(d: { nombreTienda: string; tamanoDeLetra: string }): Promise<void>
  }
  catalogo: {
    listarCategorias(): Promise<{ id: string; nombre: string }[]>
    crearProducto(
      d: Record<string, unknown>,
    ): Promise<{ tipo: string; valor?: { productoId: string } }>
  }
  inventario: {
    registrarVenta(d: { lineas: { productoId: string; cantidad: string }[] }): Promise<unknown>
    registrarMerma(d: { productoId: string; cantidad: string; motivo: string }): Promise<unknown>
    contarStock(d: { productoId: string; contado: string }): Promise<unknown>
  }
  esperarTareasPendientes(): Promise<void>
}
type VentanaConAplicacion = Window & { __aplicacion?: AplicacionEnLaPagina }

export type IdsDeDemostracion = Record<string, string>

async function crearProductos(page: Page): Promise<IdsDeDemostracion> {
  // Sin `vendeEl`: una función no viaja a la página.
  const productos = PRODUCTOS_DE_DEMOSTRACION.map((p) => ({
    nombre: p.nombre,
    categoria: p.categoria,
    unidad: p.unidad,
    compra: p.compra,
    venta: p.venta,
    minimo: p.minimo,
    stockInicial: p.stockInicial,
  }))
  return page.evaluate(
    async ({ productos, nombreTienda }) => {
      const app = (window as VentanaConAplicacion).__aplicacion
      if (!app) throw new Error('La app no expuso window.__aplicacion')
      // La primera vez ya pasó (si no, Inicio llevaría a la bienvenida); la letra no cambia.
      const { tamanoDeLetra } = await app.tienda.obtenerConfiguracion()
      await app.tienda.completarPrimeraVez({ nombreTienda, tamanoDeLetra })
      const categorias = await app.catalogo.listarCategorias()
      const ids: Record<string, string> = {}
      for (const p of productos) {
        const categoria = categorias.find((c) => c.nombre === p.categoria)
        if (!categoria) throw new Error(`Falta la categoría "${p.categoria}"`)
        const respuesta = await app.catalogo.crearProducto({
          nombre: p.nombre,
          categoriaId: categoria.id,
          unidad: p.unidad,
          precioCompra: p.compra,
          precioVenta: p.venta,
          stockMinimo: p.minimo,
          stockInicial: String(p.stockInicial),
          confirmado: true,
        })
        if (respuesta.tipo !== 'hecho' || !respuesta.valor) {
          throw new Error(`No se creó "${p.nombre}": ${JSON.stringify(respuesta)}`)
        }
        ids[p.nombre] = respuesta.valor.productoId
      }
      await app.esperarTareasPendientes()
      return ids
    },
    { productos, nombreTienda: NOMBRE_DE_LA_TIENDA },
  )
}

interface VentaDelDia {
  lineas: { productoId: string; cantidad: string }[]
}

/** Las ventas de un día, en dos clientes, sin vender lo que ya no hay (RN-OP-04). */
function ventasDelDia(
  ids: IdsDeDemostracion,
  stock: Map<string, number>,
  dia: string,
  semana: number,
): VentaDelDia[] {
  const clientes: VentaDelDia[] = [{ lineas: [] }, { lineas: [] }]
  PRODUCTOS_DE_DEMOSTRACION.forEach((p, i) => {
    const cantidad = Math.min(p.vendeEl(diaDeLaSemana(dia), semana), stock.get(p.nombre) ?? 0)
    if (cantidad <= 0) return
    stock.set(p.nombre, (stock.get(p.nombre) ?? 0) - cantidad)
    clientes[i % 2]!.lineas.push({ productoId: ids[p.nombre]!, cantidad: String(cantidad) })
  })
  return clientes.filter((c) => c.lineas.length > 0)
}

async function registrarVentas(page: Page, ventas: VentaDelDia[]): Promise<void> {
  await page.evaluate(async (ventasDelDia) => {
    const app = (window as VentanaConAplicacion).__aplicacion
    if (!app) throw new Error('La app no expuso window.__aplicacion')
    for (const venta of ventasDelDia) await app.inventario.registrarVenta(venta)
    await app.esperarTareasPendientes()
  }, ventas)
}

/**
 * Instala el reloj en el primer día, abre la app, arma las ocho semanas y deja el reloj en
 * "hoy" a las 18:00, con algunas ventas de hoy. Llamar ANTES de cualquier `abrir` (el reloj de
 * Playwright se instala antes de cargar la página). Después, navegar dentro de la app (sin
 * recargar) para que cada pantalla calcule con el "hoy" nuevo.
 */
export async function prepararHistoriaDeDemostracion(
  page: Page,
  ruta = './',
): Promise<IdsDeDemostracion> {
  await page.clock.install({ time: enLima(PRIMER_DIA, '08:00') })
  await abrir(page, ruta)
  const ids = await crearProductos(page)
  const stock = new Map(PRODUCTOS_DE_DEMOSTRACION.map((p) => [p.nombre, p.stockInicial]))

  for (let n = 0; n < DIAS_DE_HISTORIA; n += 1) {
    const dia = sumarDias(PRIMER_DIA, n)
    await page.clock.setSystemTime(enLima(dia, '10:00'))
    await registrarVentas(page, ventasDelDia(ids, stock, dia, Math.floor(n / 7)))
  }

  // La última semana: una Lejía derramada y el papel contado con uno menos.
  await page.clock.setSystemTime(enLima('2026-10-12', '19:00'))
  await page.evaluate(async (lejia) => {
    const app = (window as VentanaConAplicacion).__aplicacion!
    await app.inventario.registrarMerma({ productoId: lejia, cantidad: '1', motivo: 'Se derramó' })
  }, ids['Lejía Tradicional 1 L']!)
  stock.set('Lejía Tradicional 1 L', stock.get('Lejía Tradicional 1 L')! - 1)
  await page.clock.setSystemTime(enLima('2026-10-13', '19:00'))
  const papel = ids['Papel higiénico x4']!
  const contado = String(stock.get('Papel higiénico x4')! - 1)
  await page.evaluate(
    async ({ productoId, contado }) => {
      const app = (window as VentanaConAplicacion).__aplicacion!
      await app.inventario.contarStock({ productoId, contado })
    },
    { productoId: papel, contado },
  )

  // Hoy, hasta las 18:00.
  await page.clock.setSystemTime(enLima(HOY_DE_DEMOSTRACION, '18:00'))
  await registrarVentas(page, [
    {
      lineas: [
        { productoId: ids['Lejía Tradicional 1 L']!, cantidad: '2' },
        { productoId: ids['Detergente Bolívar 900 g']!, cantidad: '1' },
      ],
    },
    { lineas: [{ productoId: papel, cantidad: '1' }] },
  ])
  return ids
}
