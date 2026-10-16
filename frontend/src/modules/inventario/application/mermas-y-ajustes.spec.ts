import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { MOTIVO_CONTEO, MOTIVO_PRODUCTO_RETIRADO } from '@/shared/contratos/operaciones'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { Operacion } from '../domain/operacion'
import { crearEscenario } from '../__pruebas__/escenario'
import { resultadoDeAsync } from '../__pruebas__/resultado'

const escenario = () => crearEscenario((almacen) => new UnidadDeTrabajoEnMemoria(almacen))
const unidades = (n: number) => Cantidad.deEntero(n)
const kilos = (texto: string) => Cantidad.deTexto(texto, 'KILO')
const soles = (texto: string) => Dinero.deTexto(texto)

describe('registrarMerma', () => {
  it('RN-OP-15: una merma resta el stock, guarda el motivo y el costo vigente (pérdida)', async () => {
    const { modulo, stock, operaciones } = await escenario()
    const { operacionId } = await modulo.registrarMerma({
      productoId: 'lejia',
      cantidad: '2',
      motivo: 'Se derramó',
    })
    expect(await stock('lejia')).toEqual(unidades(8))
    const registro = (await operaciones.porId(operacionId))!
    expect(registro).toMatchObject({ tipo: 'MERMA', motivo: 'Se derramó', nota: null })
    expect(registro.movimientos).toEqual([
      { productoId: 'lejia', cantidad: -2000, costoUnitario: 240, precioUnitario: null },
    ])
    expect(Operacion.desdeRegistro(registro).lineas()[0]?.costoTotal).toEqual(soles('4.80'))
  })

  it.each([
    ['Se venció', '', 'registrada'],
    ['Otro', 'Se lo llevó un niño', 'registrada'],
    ['Otro', '', 'error: Cuéntanos qué pasó'],
    ['', '', 'error: Elige qué pasó con el producto'],
  ])(
    'RN-OP-15: merma de 1 Lejía con motivo "%s" y nota "%s" → %s',
    async (motivo, nota, resultado) => {
      const { modulo } = await escenario()
      const merma = () =>
        modulo.registrarMerma({ productoId: 'lejia', cantidad: '1', motivo, nota })
      expect(await resultadoDeAsync(merma)).toBe(resultado)
    },
  )

  it('RN-OP-15: con "Otro" guarda la nota', async () => {
    const { modulo, ultima } = await escenario()
    await modulo.registrarMerma({
      productoId: 'lejia',
      cantidad: '1',
      motivo: 'Otro',
      nota: 'Se lo llevó un niño',
    })
    expect((await ultima())?.nota).toBe('Se lo llevó un niño')
  })

  it('RN-OP-05 / RN-OP-08 / RN-OP-09: la merma valida stock, producto activo y fecha', async () => {
    const { modulo, catalogo } = await escenario()
    await expect(
      modulo.registrarMerma({ productoId: 'carbon', cantidad: '10.5', motivo: 'Se venció' }),
    ).rejects.toThrow('Solo quedan 10 kg de Carbón')
    await expect(
      modulo.registrarMerma({
        productoId: 'carbon',
        cantidad: '1',
        motivo: 'Se venció',
        ocurridaEn: '2026-10-01T15:00:00.000Z',
      }),
    ).rejects.toThrow('Solo puedes anotar hasta 7 días atrás')
    catalogo.archivar('carbon')
    await expect(
      modulo.registrarMerma({ productoId: 'carbon', cantidad: '1', motivo: 'Se venció' }),
    ).rejects.toThrow('Carbón está archivado. Reactívalo para usarlo')
  })
})

describe('contarStock', () => {
  it('RN-OP-16: contar stock registra un AJUSTE por la diferencia, con el costo vigente', async () => {
    const { modulo, stock, operaciones } = await escenario()
    const respuesta = await modulo.contarStock({ productoId: 'lejia', contado: '8' })
    expect(respuesta).toEqual({
      tipo: 'ajustado',
      operacionId: expect.any(String),
      diferencia: unidades(-2),
    })
    const id = respuesta.tipo === 'ajustado' ? respuesta.operacionId : ''
    const registro = (await operaciones.porId(id))!
    expect(registro).toMatchObject({ tipo: 'AJUSTE', motivo: MOTIVO_CONTEO })
    expect(registro.movimientos).toEqual([
      { productoId: 'lejia', cantidad: -2000, costoUnitario: 240, precioUnitario: null },
    ])
    expect(Operacion.desdeRegistro(registro).lineas()[0]?.costoTotal).toEqual(soles('4.80'))
    expect(await stock('lejia')).toEqual(unidades(8))
  })

  it('RN-OP-16: si el conteo coincide no se registra nada', async () => {
    const { modulo, tipos, eventos } = await escenario()
    expect(await modulo.contarStock({ productoId: 'lejia', contado: '10' })).toEqual({
      tipo: 'sin-cambios',
      mensaje: 'El stock ya estaba correcto',
    })
    expect(await tipos('lejia')).toEqual(['STOCK_INICIAL'])
    expect(eventos).toEqual([])
  })

  it('RN-OP-16: la diferencia puede ser positiva y respeta los decimales de la unidad', async () => {
    const { modulo, stock } = await escenario()
    const respuesta = await modulo.contarStock({ productoId: 'carbon', contado: '12.5' })
    expect(respuesta).toMatchObject({ tipo: 'ajustado', diferencia: kilos('2.5') })
    expect(await stock('carbon')).toEqual(kilos('12.5'))
  })

  it('RN-OP-16: contar 0 deja el stock en 0', async () => {
    const { modulo, stock } = await escenario()
    await modulo.contarStock({ productoId: 'detergente', contado: '0' })
    expect(await stock('detergente')).toEqual(Cantidad.cero())
  })

  it('RN-OP-16 / RN-OP-08: valida lo contado y que el producto esté activo', async () => {
    const { modulo, catalogo } = await escenario()
    await expect(modulo.contarStock({ productoId: 'lejia', contado: '-1' })).rejects.toThrow(
      'La cantidad contada no puede ser negativa',
    )
    await expect(modulo.contarStock({ productoId: 'lejia', contado: '1.5' })).rejects.toThrow(
      'Este producto se cuenta por unidades enteras',
    )
    catalogo.archivar('lejia')
    await expect(modulo.contarStock({ productoId: 'lejia', contado: '8' })).rejects.toThrow(
      'Lejía 1 L está archivado. Reactívalo para usarlo',
    )
  })
})

describe('stock inicial y retiro (lo que usa Catálogo)', () => {
  it('RN-CAT-08: registrarStockInicial suma con el costo recibido', async () => {
    const { modulo, stock, ultima, eventos } = await escenario()
    await modulo.consultable.registrarStockInicial('nuevo', kilos('3.5'), soles('1.20'))
    expect(await stock('nuevo')).toEqual(kilos('3.5'))
    expect(await ultima()).toMatchObject({
      tipo: 'STOCK_INICIAL',
      movimientos: [
        { productoId: 'nuevo', cantidad: 3500, costoUnitario: 120, precioUnitario: null },
      ],
      dispositivoId: 'disp-1',
    })
    expect(eventos).toEqual([
      expect.objectContaining({ tipo: 'OperacionRegistrada', tipoOperacion: 'STOCK_INICIAL' }),
    ])
  })

  it('RN-OP-03: el stock inicial es mayor que 0', async () => {
    const { modulo } = await escenario()
    await expect(
      modulo.consultable.registrarStockInicial('nuevo', Cantidad.cero(), soles('1.20')),
    ).rejects.toThrow('La cantidad debe ser mayor que 0')
  })

  it('RN-CAT-11: retirarStock registra un AJUSTE hasta 0 con motivo "Producto retirado"', async () => {
    const { modulo, stock, ultima } = await escenario()
    await modulo.registrarVenta({ lineas: [{ productoId: 'carbon', cantidad: '1.5' }] })
    await modulo.consultable.retirarStock('carbon')
    expect(await stock('carbon')).toEqual(Cantidad.cero())
    expect(await ultima()).toMatchObject({
      tipo: 'AJUSTE',
      motivo: MOTIVO_PRODUCTO_RETIRADO,
      movimientos: [
        { productoId: 'carbon', cantidad: -8500, costoUnitario: 275, precioUnitario: null },
      ],
    })
  })

  it('RN-CAT-11: con stock 0, retirarStock no registra nada', async () => {
    const { modulo, tipos } = await escenario()
    await modulo.contarStock({ productoId: 'lejia', contado: '0' })
    await modulo.consultable.retirarStock('lejia')
    expect(await tipos('lejia')).toEqual(['STOCK_INICIAL', 'AJUSTE'])
  })

  it('RN-CAT-11: retirarStock funciona aunque el producto ya esté archivado, pero no si no existe', async () => {
    const { modulo, stock, catalogo } = await escenario()
    catalogo.archivar('lejia')
    await modulo.consultable.retirarStock('lejia')
    expect(await stock('lejia')).toEqual(Cantidad.cero())
    await expect(modulo.consultable.retirarStock('nada')).rejects.toThrow(
      'No encontramos ese producto',
    )
  })
})
