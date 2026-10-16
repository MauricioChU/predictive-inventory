import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { alReves } from '../__pruebas__/dobles'
import { ANTECEDENTES, crearEscenario } from '../__pruebas__/escenario'

const escenario = () => crearEscenario((almacen) => new UnidadDeTrabajoEnMemoria(almacen))
const kilos = (texto: string) => Cantidad.deTexto(texto, 'KILO')

describe('consultable (InventarioParaCatalogo)', () => {
  it('stockDe y existencias', async () => {
    const { modulo } = await escenario()
    await modulo.registrarVenta({ lineas: [{ productoId: 'carbon', cantidad: '1.25' }] })
    expect(await modulo.consultable.stockDe('carbon')).toEqual(kilos('8.75'))
    expect(await modulo.consultable.stockDe('nada')).toEqual(Cantidad.cero())
    expect(await modulo.consultable.existencias()).toEqual(
      new Map([
        ['lejia', Cantidad.deEntero(10)],
        ['carbon', kilos('8.75')],
        ['detergente', kilos('5')],
      ]),
    )
  })

  it('RN-CAT-03: tieneOperaciones', async () => {
    const { modulo } = await escenario()
    expect(await modulo.consultable.tieneOperaciones('lejia')).toBe(true)
    expect(await modulo.consultable.tieneOperaciones('nuevo')).toBe(false)
    await modulo.consultable.registrarStockInicial('nuevo', Cantidad.deEntero(1), Dinero.cero())
    expect(await modulo.consultable.tieneOperaciones('nuevo')).toBe(true)
  })

  it('operaciones devuelve todo el libro en el orden en que se registró', async () => {
    const { modulo } = await escenario()
    const { operacionId } = await modulo.registrarVenta({
      lineas: [{ productoId: 'lejia', cantidad: '1' }],
    })
    const registros = await modulo.consultable.operaciones()
    expect(registros.map((r) => r.tipo)).toEqual([
      'STOCK_INICIAL',
      'STOCK_INICIAL',
      'STOCK_INICIAL',
      'VENTA',
    ])
    expect(registros.at(-1)?.id).toBe(operacionId)
  })
})

describe('orden del libro', () => {
  it('operaciones() y el historial siguen el orden de registro aunque el repositorio no lo dé', async () => {
    const e = await crearEscenario(
      (almacen) => new UnidadDeTrabajoEnMemoria(almacen),
      ANTECEDENTES,
      {
        envolverOperaciones: alReves,
      },
    )
    e.reloj.avanzarSegundos(1)
    await e.modulo.registrarVenta({ lineas: [{ productoId: 'lejia', cantidad: '1' }] })
    e.reloj.avanzarSegundos(1)
    await e.modulo.registrarIngreso({
      lineas: [{ productoId: 'lejia', cantidad: '6', costo: '2.40' }],
    })
    expect((await e.modulo.consultable.operaciones()).map((r) => r.tipo)).toEqual([
      'STOCK_INICIAL',
      'STOCK_INICIAL',
      'STOCK_INICIAL',
      'VENTA',
      'INGRESO',
    ])
    expect((await e.modulo.historial({ productoId: 'lejia' })).map((o) => o.tipo)).toEqual([
      'INGRESO',
      'VENTA',
      'STOCK_INICIAL',
    ])
  })
})

describe('index', () => {
  it('expone la API pública del módulo', async () => {
    const api = await import('../index')
    expect(Object.keys(api).sort()).toEqual(
      [
        'BILLETES_RAPIDOS',
        'Carrito',
        'OPCIONES_DE_SOBRECOMPRA',
        'RepositorioDeConteoDexie',
        'RepositorioDeConteoEnMemoria',
        'RepositorioDeExistenciasDexie',
        'RepositorioDeExistenciasEnMemoria',
        'RepositorioDeOperacionesDexie',
        'RepositorioDeOperacionesEnMemoria',
        'SEGUNDOS_PARA_DESHACER',
        'ServicioDeDeshacer',
        'calcularVuelto',
        'crearModuloInventario',
        'etiquetaDeOperacion',
      ].sort(),
    )
  })
})
