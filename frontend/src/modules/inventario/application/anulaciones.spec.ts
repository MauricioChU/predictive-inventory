import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { crearEscenario } from '../__pruebas__/escenario'

const escenario = () => crearEscenario((almacen) => new UnidadDeTrabajoEnMemoria(almacen))
const unidades = (n: number) => Cantidad.deEntero(n)

async function conVentaDe2Lejias() {
  const e = await escenario()
  const { operacionId } = await e.modulo.registrarVenta({
    lineas: [{ productoId: 'lejia', cantidad: '2' }],
  })
  return { ...e, ventaId: operacionId }
}

describe('anularOperacion', () => {
  it('RN-OP-02 / RN-OP-17: corregir una venta no la borra: se anula y el stock vuelve', async () => {
    const { modulo, ventaId, stock, tipos, operaciones } = await conVentaDe2Lejias()
    const { anulacionId } = await modulo.anularOperacion({ operacionId: ventaId })
    expect(await tipos('lejia')).toEqual(['STOCK_INICIAL', 'VENTA', 'ANULACION'])
    expect(await stock('lejia')).toEqual(unidades(10))
    expect(await operaciones.porId(ventaId)).not.toBeNull()
    expect(await operaciones.porId(anulacionId)).toMatchObject({
      tipo: 'ANULACION',
      anulaA: ventaId,
      motivo: null,
      movimientos: [
        { productoId: 'lejia', cantidad: 2000, costoUnitario: 240, precioUnitario: null },
      ],
    })
    const venta = (await modulo.historial({ productoId: 'lejia' })).find((o) => o.id === ventaId)
    expect(venta?.anulada).toBe(true)
  })

  it('RN-OP-17: guarda el motivo si se indica', async () => {
    const { modulo, ventaId, operaciones } = await conVentaDe2Lejias()
    const { anulacionId } = await modulo.anularOperacion({
      operacionId: ventaId,
      motivo: 'Cobré de más',
    })
    expect((await operaciones.porId(anulacionId))?.motivo).toBe('Cobré de más')
  })

  it('RN-OP-17: una operación solo se anula una vez', async () => {
    const { modulo, ventaId, tipos } = await conVentaDe2Lejias()
    await modulo.anularOperacion({ operacionId: ventaId })
    await expect(modulo.anularOperacion({ operacionId: ventaId })).rejects.toThrow(
      'Esta operación ya fue anulada',
    )
    expect(await tipos('lejia')).toEqual(['STOCK_INICIAL', 'VENTA', 'ANULACION'])
  })

  it('RN-OP-17: una anulación no se puede anular', async () => {
    const { modulo, ventaId } = await conVentaDe2Lejias()
    const { anulacionId } = await modulo.anularOperacion({ operacionId: ventaId })
    await expect(modulo.anularOperacion({ operacionId: anulacionId })).rejects.toThrow(
      'Una anulación no se puede anular. Registra la operación de nuevo',
    )
  })

  it('RN-OP-17: no se anula una operación que no existe', async () => {
    const { modulo } = await escenario()
    await expect(modulo.anularOperacion({ operacionId: 'nada' })).rejects.toThrow(
      'No encontramos esa operación',
    )
  })

  it('RN-OP-17 / RN-OP-05: no se anula un ingreso cuya mercadería ya se vendió', async () => {
    const { modulo, stock } = await escenario()
    const ingreso = await modulo.registrarIngreso({
      lineas: [{ productoId: 'detergente', cantidad: '3', costo: '5.30' }],
    })
    await modulo.registrarVenta({ lineas: [{ productoId: 'detergente', cantidad: '7' }] })
    const ingresoId = ingreso.tipo === 'hecho' ? ingreso.operacionId : ''
    await expect(modulo.anularOperacion({ operacionId: ingresoId })).rejects.toThrow(
      'Solo queda 1 kg de Detergente a granel',
    )
    expect(await stock('detergente')).toEqual(unidades(1))
  })

  it('RN-OP-17: las proyecciones reciben alAnular(original, anulacion) y se publica OperacionAnulada', async () => {
    const { modulo, ventaId, proyeccion, operaciones, eventos } = await conVentaDe2Lejias()
    const { anulacionId } = await modulo.anularOperacion({ operacionId: ventaId })
    expect(proyeccion.anuladas).toEqual([
      {
        original: await operaciones.porId(ventaId),
        anulacion: await operaciones.porId(anulacionId),
      },
    ])
    expect(eventos.at(-1)).toEqual({
      tipo: 'OperacionAnulada',
      operacionId: ventaId,
      anulacionId,
      productoIds: ['lejia'],
    })
  })

  it('RN-OP-08: se puede anular una operación pasada de un producto ya archivado', async () => {
    const { modulo, ventaId, catalogo, stock } = await conVentaDe2Lejias()
    catalogo.archivar('lejia')
    await modulo.anularOperacion({ operacionId: ventaId })
    expect(await stock('lejia')).toEqual(unidades(10))
  })

  it('RN-OP-17: una venta de varias líneas se anula entera', async () => {
    const { modulo, stock } = await escenario()
    const { operacionId } = await modulo.registrarVenta({
      lineas: [
        { productoId: 'lejia', cantidad: '2' },
        { productoId: 'carbon', cantidad: '1.25' },
      ],
    })
    await modulo.anularOperacion({ operacionId })
    expect(await stock('lejia')).toEqual(unidades(10))
    expect(await stock('carbon')).toEqual(unidades(10))
  })

  it('RN-OP-17: se anula aunque el catálogo ya no conozca el producto', async () => {
    const { modulo, operaciones, stock } = await escenario()
    await modulo.consultable.registrarStockInicial('nuevo', unidades(3), Dinero.cero())
    const inicial = (await operaciones.todas()).at(-1)!
    await modulo.anularOperacion({ operacionId: inicial.id })
    expect(await stock('nuevo')).toEqual(Cantidad.cero())
  })
})
