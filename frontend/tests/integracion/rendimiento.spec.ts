// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { instanteLocal } from '@/shared/domain/fecha'
import { crearAplicacionDePrueba, type AplicacionDePrueba } from '../soporte/aplicacion-de-prueba'
import { generarDatosMasivos, type DatosMasivos } from '../soporte/datos-masivos'

const HOY = '2026-10-15'

/** Presupuestos de RN-SIS-09 (en un celular de gama media; aquí, la máquina que corre Vitest). */
const PRESUPUESTO_TORRE_MS = 1000
const PRESUPUESTO_VENTA_MS = 300

/** Ventas de la ráfaga: una tras otra, cada una esperada, sin pausa entre ellas. */
const VENTAS_EN_RAFAGA = 10

function mediana(valores: readonly number[]): number {
  const orden = [...valores].sort((a, b) => a - b)
  return orden[Math.floor(orden.length / 2)]!
}

function peor(valores: readonly number[]): number {
  return Math.max(...valores)
}

async function medir<T>(trabajo: () => Promise<T>): Promise<{ ms: number; valor: T }> {
  const inicio = performance.now()
  const valor = await trabajo()
  return { ms: Math.round(performance.now() - inicio), valor }
}

interface Medicion {
  carga: number
  reconstruir: number
  torre: number[]
  ventaEnCalma: number[]
  ventaEnRafaga: number[]
  situaciones: number
  evaluarAvisos: number
}

/**
 * RN-SIS-09 con 300 productos y 50 000 movimientos en un año, sobre Dexie con durabilidad
 * 'strict' y las lecturas de Análisis dentro de `uow.ejecutar` (transacción 'rw'). La historia
 * se carga como una copia (`reemplazarTodo`) y las proyecciones se reconstruyen con el caso de
 * uso real. Corre sobre fake-indexeddb (IndexedDB en JavaScript, sin disco ni el motor del
 * navegador): se exigen los presupuestos con lo que se mide aquí, y el umbral en un celular de
 * gama media lo verifica el E2E de la Ola 5. Solo Dexie: la persistencia en memoria es para
 * pruebas con pocos datos (copia todo el almacén en cada transacción y en cada lectura).
 */
describe('RN-SIS-09: rendimiento con datos realistas (Dexie)', () => {
  let app: AplicacionDePrueba
  let datos: DatosMasivos
  const medicion: Medicion = {
    carga: 0,
    reconstruir: 0,
    torre: [],
    ventaEnCalma: [],
    ventaEnRafaga: [],
    situaciones: 0,
    evaluarAvisos: 0,
  }

  beforeAll(async () => {
    datos = generarDatosMasivos({ hoy: HOY })
    app = crearAplicacionDePrueba({ ahora: instanteLocal(`${HOY} 10:00`), almacen: 'dexie' })
    await app.tienda.completarPrimeraVez({ nombreTienda: 'Bodega Rosita', tamanoDeLetra: 'GRANDE' })
    medicion.carga = (
      await medir(() =>
        app.infraestructura.almacenDeRespaldo.reemplazarTodo({
          configuracion: null,
          categorias: datos.categorias,
          productos: datos.productos,
          operaciones: datos.operaciones,
          avisos: [],
          fotos: [],
        }),
      )
    ).ms
    medicion.reconstruir = (await medir(() => app.inventario.reconstruirExistencias())).ms
    await app.esperarTareasPendientes()
  }, 120_000)

  afterAll(async () => {
    await app.cerrar()
    const rafaga = medicion.ventaEnRafaga
    console.log(
      `RN-SIS-09 (ms, Dexie + fake-indexeddb): carga ${medicion.carga}, ` +
        `reconstruir ${medicion.reconstruir}, torre [${medicion.torre.join(', ')}], ` +
        `venta en calma [${medicion.ventaEnCalma.join(', ')}], ` +
        `venta en ráfaga [${rafaga.join(', ')}] (mediana ${mediana(rafaga)}, peor ${peor(rafaga)}), ` +
        `situaciones ${medicion.situaciones}, evaluarAvisos ${medicion.evaluarAvisos}`,
    )
  })

  it('los datos generados son los de la regla: 300 productos y 50 000 movimientos', () => {
    expect(datos.productos).toHaveLength(300)
    expect(datos.movimientos).toBe(50_000)
  })

  it(`RN-SIS-09: la Torre de control carga en menos de ${PRESUPUESTO_TORRE_MS} ms`, async () => {
    for (let i = 0; i < 3; i += 1) {
      const { ms, valor } = await medir(() => app.analisis.consultarTorre())
      medicion.torre.push(ms)
      expect(valor.atencion.agotados + valor.atencion.porAcabarse).toBeGreaterThanOrEqual(0)
    }
    expect(mediana(medicion.torre)).toBeLessThan(PRESUPUESTO_TORRE_MS)
  }, 60_000)

  it(`RN-SIS-09: una venta se confirma en menos de ${PRESUPUESTO_VENTA_MS} ms`, async () => {
    const productos = datos.productos.filter((p) => p.unidad === 'UNIDAD').slice(0, 30)
    const lineas = (i: number) =>
      productos.slice(i * 3, i * 3 + 3).map((p) => ({ productoId: p.id, cantidad: '1' }))
    // En calma: entre una venta y otra ya terminó la re-evaluación de avisos (la persona tarda
    // segundos en armar la siguiente).
    for (let i = 0; i < 5; i += 1) {
      const { ms } = await medir(() => app.inventario.registrarVenta({ lineas: lineas(i) }))
      medicion.ventaEnCalma.push(ms)
      await app.esperarTareasPendientes()
    }
    // En ráfaga (informativo, sin presupuesto): cada venta llega apenas confirmó la anterior
    // ("confirmar" = hasta que `registrarVenta` resuelve), con los avisos y el contador que
    // disparó la anterior todavía pendientes. Aquí no se exige: fake-indexeddb tarda ~100 ms en
    // REESCRIBIR una fila existente de una tabla grande (las de hoy de los productos que ya se
    // vendieron en calma), cosa que IndexedDB del navegador hace en milisegundos. RN-SIS-09 en
    // ráfaga lo mide la E2E opcional (e2e/rendimiento.spec.ts, CPU x4).
    for (let i = 0; i < VENTAS_EN_RAFAGA; i += 1) {
      const { ms } = await medir(() => app.inventario.registrarVenta({ lineas: lineas(i) }))
      medicion.ventaEnRafaga.push(ms)
    }
    await app.esperarTareasPendientes()
    medicion.situaciones = (await medir(() => app.analisis.consultable.situaciones())).ms
    medicion.evaluarAvisos = (await medir(() => app.alertas.evaluarAvisos())).ms

    expect(medicion.ventaEnRafaga).toHaveLength(VENTAS_EN_RAFAGA)
    expect(mediana(medicion.ventaEnCalma)).toBeLessThan(PRESUPUESTO_VENTA_MS)
  }, 60_000)
})
