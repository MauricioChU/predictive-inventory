import process from 'node:process'
import { expect, test } from '@playwright/test'
import { abrir } from './utilidades/navegacion'
import { copiaConHistoria, frenarCpu, mediana } from './utilidades/rendimiento'

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

/** Ventas de la ráfaga: una tras otra, cada una esperada, sin pausa entre ellas. */
const VENTAS_EN_RAFAGA = 10

/**
 * A paso de cajero: entre una venta y la siguiente pasan ~350 ms, un poco más que la ventana con
 * que Alertas junta las re-evaluaciones (300 ms). Cada venta llega justo cuando corre la
 * re-evaluación que disparó la anterior: el peor caso de una persona rápida.
 */
const PAUSA_DE_CAJERO_MS = 350

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
      const { texto, productos } = copiaConHistoria(3 * VENTAS_EN_RAFAGA)
      await abrir(page, './')
      await frenarCpu(page, lentitud)

      const medicion = await page.evaluate(
        async ({ copia, ids, rafaga, pausaDeCajero }) => {
          const app = (window as VentanaConAplicacion).__aplicacion
          if (!app) throw new Error('La app no expuso window.__aplicacion')
          const medir = async (trabajo: () => Promise<unknown>) => {
            const inicio = performance.now()
            await trabajo()
            return Math.round(performance.now() - inicio)
          }
          const lineas = (i: number) =>
            ids.slice(i * 3, i * 3 + 3).map((productoId) => ({ productoId, cantidad: '1' }))

          const restaurar = await medir(() =>
            app.respaldo.restaurarCopia(copia, { confirmaciones: 2 }),
          )
          await app.esperarTareasPendientes()
          const torre: number[] = []
          for (let i = 0; i < 3; i += 1)
            torre.push(await medir(() => app.analisis.consultarTorre()))
          const ventaEnCalma: number[] = []
          for (let i = 0; i < 5; i += 1) {
            ventaEnCalma.push(
              await medir(() => app.inventario.registrarVenta({ lineas: lineas(i) })),
            )
            await app.esperarTareasPendientes()
            await new Promise((resolver) => setTimeout(resolver, 300))
          }
          // Ráfaga: cada venta llega apenas confirmó la anterior (con los avisos y el contador
          // que disparó la anterior todavía pendientes).
          const ventaEnRafaga: number[] = []
          for (let i = 0; i < rafaga; i += 1) {
            ventaEnRafaga.push(
              await medir(() => app.inventario.registrarVenta({ lineas: lineas(i) })),
            )
          }
          await app.esperarTareasPendientes()
          // A paso de cajero (informativo, como la ráfaga): con la re-evaluación de la anterior
          // en curso.
          const ventaAPasoDeCajero: number[] = []
          for (let i = 0; i < rafaga; i += 1) {
            await new Promise((resolver) => setTimeout(resolver, pausaDeCajero))
            ventaAPasoDeCajero.push(
              await medir(() => app.inventario.registrarVenta({ lineas: lineas(i) })),
            )
          }
          await app.esperarTareasPendientes()
          const situaciones = await medir(() => app.analisis.consultable.situaciones())
          const evaluarAvisos = await medir(() => app.alertas.evaluarAvisos())
          return {
            restaurar,
            torre,
            ventaEnCalma,
            ventaEnRafaga,
            ventaAPasoDeCajero,
            situaciones,
            evaluarAvisos,
          }
        },
        {
          copia: texto,
          ids: productos,
          rafaga: VENTAS_EN_RAFAGA,
          pausaDeCajero: PAUSA_DE_CAJERO_MS,
        },
      )

      const { ventaEnRafaga, ventaAPasoDeCajero } = medicion
      const resumen =
        `RN-SIS-09 en Chromium (CPU x${lentitud}, ms): ${JSON.stringify(medicion)}; ` +
        `ráfaga: mediana ${mediana(ventaEnRafaga)}, peor ${Math.max(...ventaEnRafaga)}; ` +
        `a paso de cajero (${PAUSA_DE_CAJERO_MS} ms): mediana ${mediana(ventaAPasoDeCajero)}, ` +
        `peor ${Math.max(...ventaAPasoDeCajero)}`
      console.log(resumen)
      await testInfo.attach(`rendimiento-cpu-x${lentitud}`, {
        body: resumen,
        contentType: 'text/plain',
      })
      expect(medicion.torre).toHaveLength(3)
      expect(medicion.ventaEnRafaga).toHaveLength(VENTAS_EN_RAFAGA)
      expect(medicion.ventaAPasoDeCajero).toHaveLength(VENTAS_EN_RAFAGA)
    })
  }
})
