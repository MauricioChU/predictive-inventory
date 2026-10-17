// RN-SIS-09: lo que comparten las mediciones de rendimiento (e2e/rendimiento.spec.ts y, plan 16,
// e2e/recorridos/rendimiento-interfaz.spec.ts). Opcionales, con MEDIR_RENDIMIENTO=1.
import type { Page } from '@playwright/test'
import { generarDatosMasivos } from '../../tests/soporte/datos-masivos'

export function mediana(valores: readonly number[]): number {
  const orden = [...valores].sort((a, b) => a - b)
  return orden[Math.floor(orden.length / 2)]!
}

/** El "hoy" de la tienda (America/Lima, UTC−5) para que la historia termine ayer. */
function hoyEnLima(): string {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/**
 * Una copia v1 con la historia generada (300 productos, 50 000 movimientos; se carga por la
 * restauración real, RN-RE-03/04) y los ids de los primeros `productosParaVender` productos que
 * se venden por unidad.
 */
export function copiaConHistoria(productosParaVender: number): { texto: string; productos: string[] } {
  const datos = generarDatosMasivos({ hoy: hoyEnLima() })
  const stockPorProducto: Record<string, number> = {}
  for (const p of datos.productos) stockPorProducto[p.id] = 0
  for (const o of datos.operaciones) {
    for (const m of o.movimientos) stockPorProducto[m.productoId]! += m.cantidad
  }
  const texto = JSON.stringify({
    versionDeFormato: 1,
    app: 'predictive-inventory',
    creadoEn: new Date().toISOString(),
    control: {
      productos: datos.productos.length,
      operaciones: datos.operaciones.length,
      stockPorProducto,
    },
    datos: {
      configuracion: null,
      categorias: datos.categorias,
      productos: datos.productos,
      operaciones: datos.operaciones,
      avisos: [],
      fotos: [],
    },
  })
  const productos = datos.productos.filter((p) => p.unidad === 'UNIDAD').map((p) => p.id)
  return { texto, productos: productos.slice(0, productosParaVender) }
}

/** Emula una CPU `veces` más lenta (Chromium, por el protocolo de DevTools). */
export async function frenarCpu(page: Page, veces: number): Promise<void> {
  if (veces === 1) return
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: veces })
}
