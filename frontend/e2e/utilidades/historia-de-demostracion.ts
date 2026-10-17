import type { Page } from '@playwright/test'
import { prepararTienda } from './control'
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
  inventario: {
    registrarVenta(d: { lineas: { productoId: string; cantidad: string }[] }): Promise<unknown>
    registrarMerma(d: { productoId: string; cantidad: string; motivo: string }): Promise<unknown>
    contarStock(d: { productoId: string; contado: string }): Promise<unknown>
  }
  esperarTareasPendientes(): Promise<void>
}
type VentanaConAplicacion = Window & { __aplicacion?: AplicacionEnLaPagina }

export type IdsDeDemostracion = Record<string, string>

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

/** Una Lejía derramada (RN-OP-15). */
async function registrarMerma(page: Page, productoId: string): Promise<void> {
  await page.evaluate(async (id) => {
    const app = (window as VentanaConAplicacion).__aplicacion!
    await app.inventario.registrarMerma({ productoId: id, cantidad: '1', motivo: 'Se derramó' })
    await app.esperarTareasPendientes()
  }, productoId)
}

/** Un conteo con diferencia (RN-OP-16). */
async function contar(page: Page, productoId: string, contado: number): Promise<void> {
  await page.evaluate(
    async (datos) => {
      const app = (window as VentanaConAplicacion).__aplicacion!
      await app.inventario.contarStock(datos)
      await app.esperarTareasPendientes()
    },
    { productoId, contado: String(contado) },
  )
}

/**
 * El reloj de la página solo avanza: cada operación queda después de la anterior, como en una
 * tienda de verdad (una operación fechada antes que otra ya registrada no puede ocurrir).
 */
function crearReloj(page: Page): (dia: string, hora: string) => Promise<void> {
  let ultimo = 0
  return async (dia, hora) => {
    const instante = enLima(dia, hora)
    if (instante.getTime() <= ultimo) {
      throw new Error(`El reloj no puede volver atrás: ${dia} ${hora}`)
    }
    ultimo = instante.getTime()
    await page.clock.setSystemTime(instante)
  }
}

/** Día de la merma de Lejía y del conteo del papel (la última semana completa). */
const DIA_DE_LA_MERMA = '2026-10-12'
const DIA_DEL_CONTEO = '2026-10-13'

/**
 * Instala el reloj en el primer día, abre la app, arma las ocho semanas EN ORDEN (cada día sus
 * ventas a las 10:00 y, si toca, la merma o el conteo a las 19:00) y deja el reloj en "hoy" a
 * las 18:00, con algunas ventas de hoy. Llamar ANTES de cualquier `abrir` (el reloj de
 * Playwright se instala antes de cargar la página). Después, navegar dentro de la app (sin
 * recargar) para que cada pantalla calcule con el "hoy" nuevo.
 */
export async function prepararHistoriaDeDemostracion(
  page: Page,
  ruta = './',
): Promise<IdsDeDemostracion> {
  await page.clock.install({ time: enLima(PRIMER_DIA, '08:00') })
  const moverReloj = crearReloj(page)
  await abrir(page, ruta)
  // Los productos se crean el primer día: ese es su primer movimiento.
  const ids = await prepararTienda(
    page,
    PRODUCTOS_DE_DEMOSTRACION.map((p) => ({
      nombre: p.nombre,
      categoria: p.categoria,
      unidad: p.unidad,
      compra: p.compra,
      venta: p.venta,
      minimo: p.minimo,
      stockInicial: String(p.stockInicial),
    })),
    NOMBRE_DE_LA_TIENDA,
  )
  const stock = new Map(PRODUCTOS_DE_DEMOSTRACION.map((p) => [p.nombre, p.stockInicial]))
  const lejia = 'Lejía Tradicional 1 L'
  const papel = 'Papel higiénico x4'

  for (let n = 0; n < DIAS_DE_HISTORIA; n += 1) {
    const dia = sumarDias(PRIMER_DIA, n)
    await moverReloj(dia, '10:00')
    await registrarVentas(page, ventasDelDia(ids, stock, dia, Math.floor(n / 7)))
    if (dia === DIA_DE_LA_MERMA) {
      await moverReloj(dia, '19:00')
      await registrarMerma(page, ids[lejia]!)
      stock.set(lejia, stock.get(lejia)! - 1)
    }
    if (dia === DIA_DEL_CONTEO) {
      await moverReloj(dia, '19:00')
      // Se cuenta uno menos de lo que debería haber.
      const contado = stock.get(papel)! - 1
      await contar(page, ids[papel]!, contado)
      stock.set(papel, contado)
    }
  }

  // Hoy, hasta las 18:00.
  await moverReloj(HOY_DE_DEMOSTRACION, '18:00')
  await registrarVentas(page, [
    {
      lineas: [
        { productoId: ids[lejia]!, cantidad: '2' },
        { productoId: ids['Detergente Bolívar 900 g']!, cantidad: '1' },
      ],
    },
    { lineas: [{ productoId: ids[papel]!, cantidad: '1' }] },
  ])
  return ids
}
