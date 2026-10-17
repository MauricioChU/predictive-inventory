import { describe, expect, it } from 'vitest'
import { UnidadDeTrabajoEspia } from '@/shared/application/__pruebas__/unidad-de-trabajo-espia'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { crearEntorno } from '../__pruebas__/entorno'
import { nuevaOperacion } from '../domain/__pruebas__/operaciones'
import { CARBON, LEJIA } from '../domain/__pruebas__/productos'
import { crearModuloAnalisis, type ModuloAnalisis } from './modulo'

const LEJIA_LINEA = { producto: 'lejia', precio: '3.50', costo: '2.40' }
const CARBON_LINEA = { producto: 'carbon', precio: '4.00', costo: '2.75' }

/** El módulo con una UoW espía y sus puertos vigilados, sobre datos con movimientos. */
async function preparar(): Promise<{ espia: UnidadDeTrabajoEspia; modulo: ModuloAnalisis }> {
  const e = crearEntorno({
    productos: [LEJIA, CARBON],
    uow: (a) => new UnidadDeTrabajoEnMemoria(a),
  })
  await e.registrar(
    nuevaOperacion('STOCK_INICIAL', '2026-09-01 08:00', [
      { ...LEJIA_LINEA, cantidad: '20' },
      { ...CARBON_LINEA, cantidad: '10' },
    ]),
    nuevaOperacion('VENTA', '2026-10-14 10:00', [{ ...LEJIA_LINEA, cantidad: '18' }]),
  )
  const espia = new UnidadDeTrabajoEspia(new UnidadDeTrabajoEnMemoria(e.almacen))
  const modulo = crearModuloAnalisis({
    resumenes: espia.vigilar('resumenes', e.resumenes),
    listaDeCompras: espia.vigilar('listaDeCompras', e.listaDeCompras),
    uow: espia,
    reloj: e.reloj,
    catalogo: () => espia.vigilar('catalogo', e.catalogo),
    inventario: () => espia.vigilar('inventario', e.inventario),
    tienda: () => espia.vigilar('tienda', e.tienda),
  })
  return { espia, modulo }
}

const CONSULTAS: [string, (m: ModuloAnalisis) => Promise<unknown>][] = [
  ['situaciones', (m) => m.consultable.situaciones()],
  ['situacion', (m) => m.consultable.situacion('lejia')],
  ['consultarTorre', (m) => m.consultarTorre()],
  ['consultarResumen', (m) => m.consultarResumen('7_DIAS')],
  ['listaParaComprar', (m) => m.listaParaComprar()],
  ['textoParaCompartir', (m) => m.textoParaCompartir()],
  ['lineasParaRegistrarLlegada', (m) => m.lineasParaRegistrarLlegada()],
  ['necesitoComprar', (m) => m.necesitoComprar('lejia')],
  ['detalleDeProducto', (m) => m.detalleDeProducto('lejia')],
]

describe('RN-SIS-09: las consultas de Análisis leen en una sola transacción de solo lectura', () => {
  it.each(CONSULTAS)(
    'RN-SIS-09: %s lee todo dentro de UN leer y no abre escrituras',
    async (_, consulta) => {
      const { espia, modulo } = await preparar()
      await consulta(modulo)
      expect(espia.transacciones()).toEqual({ lecturas: 1, escrituras: 0 })
      expect(espia.llamadasSueltas).toEqual([])
    },
  )
})
