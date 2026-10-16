import process from 'node:process'
import { expect, test, type Page } from '@playwright/test'
import { generarDatosMasivos } from '../tests/soporte/datos-masivos'
import { abrir } from './utilidades/navegacion'

/** Lo que la medición usa de la aplicación real (window.__aplicacion). */
interface AplicacionEnLaPagina {
  respaldo: { restaurarCopia(texto: string, d: { confirmaciones: number }): Promise<void> }
  analisis: {
    consultarTorre(): Promise<unknown>
    consultable: { situaciones(): Promise<unknown[]> }
  }
  alertas: { evaluarAvisos(): Promise<unknown> }
  inventario: {
    registrarVenta(datos: { lineas: { productoId: string; cantidad: string }[] }): Promise<unknown>
  }
  esperarTareasPendientes(): Promise<void>
}
type VentanaConAplicacion = Window & { __aplicacion?: AplicacionEnLaPagina }

/** El "hoy" de la tienda (America/Lima, UTC−5) para que la historia termine ayer. */
function hoyEnLima(): string {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** Una copia v1 con la historia generada (se carga por la restauración real, RN-RE-03/04). */
function copiaConHistoria(): { texto: string; productos: string[] } {
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
  return { texto, productos: productos.slice(0, 15) }
}

/** Emula una CPU `veces` más lenta (Chromium, por el protocolo de DevTools). */
async function frenarCpu(page: Page, veces: number): Promise<void> {
  if (veces === 1) return
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: veces })
}

/**
 * RN-SIS-09 en el navegador real (IndexedDB de Chromium, durabilidad 'strict', lecturas de
 * Análisis en transacciones 'rw'), sin y con la CPU 4 veces más lenta (aproxima un celular de
 * gama media). Opcional: `MEDIR_RENDIMIENTO=1 npx playwright test e2e/rendimiento.spec.ts
 * --project=celular`. Informa los números; el umbral definitivo es de la Ola 5.
 */
test.describe('RN-SIS-09: rendimiento en el navegador real (medición opcional)', () => {
  test.skip(!process.env.MEDIR_RENDIMIENTO, 'Solo con MEDIR_RENDIMIENTO=1')

  for (const lentitud of [1, 4]) {
    test(`300 productos y 50 000 movimientos, CPU x${lentitud}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'celular', 'Se mide una vez, en el perfil de celular')
      test.setTimeout(600_000)
      const { texto, productos } = copiaConHistoria()
      await abrir(page, './')
      await frenarCpu(page, lentitud)

      const medicion = await page.evaluate(
        async ({ copia, ids }) => {
          const app = (window as VentanaConAplicacion).__aplicacion
          if (!app) throw new Error('La app no expuso window.__aplicacion')
          const medir = async (trabajo: () => Promise<unknown>) => {
            const inicio = performance.now()
            await trabajo()
            return Math.round(performance.now() - inicio)
          }
          const lineas = (i: number) =>
            ids.slice(i * 3, i * 3 + 3).map((productoId) => ({ productoId, cantidad: '1' }))

          const restaurar = await medir(() => app.respaldo.restaurarCopia(copia, { confirmaciones: 2 }))
          await app.esperarTareasPendientes()
          const torre: number[] = []
          for (let i = 0; i < 3; i += 1) torre.push(await medir(() => app.analisis.consultarTorre()))
          const ventaEnCalma: number[] = []
          for (let i = 0; i < 5; i += 1) {
            ventaEnCalma.push(await medir(() => app.inventario.registrarVenta({ lineas: lineas(i) })))
            await app.esperarTareasPendientes()
            await new Promise((resolver) => setTimeout(resolver, 300))
          }
          const ventaSeguida: number[] = []
          for (let i = 0; i < 5; i += 1) {
            ventaSeguida.push(await medir(() => app.inventario.registrarVenta({ lineas: lineas(i) })))
          }
          await app.esperarTareasPendientes()
          const situaciones = await medir(() => app.analisis.consultable.situaciones())
          const evaluarAvisos = await medir(() => app.alertas.evaluarAvisos())
          return { restaurar, torre, ventaEnCalma, ventaSeguida, situaciones, evaluarAvisos }
        },
        { copia: texto, ids: productos },
      )

      const resumen = `RN-SIS-09 en Chromium (CPU x${lentitud}, ms): ${JSON.stringify(medicion)}`
      console.log(resumen)
      await testInfo.attach(`rendimiento-cpu-x${lentitud}`, { body: resumen, contentType: 'text/plain' })
      expect(medicion.torre).toHaveLength(3)
    })
  }
})
