import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { MOTIVO_CONTEO } from '@/shared/contratos/operaciones'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { crearEscenario, type ProductoDePrueba } from '../__pruebas__/escenario'

const escenario = (productos?: readonly ProductoDePrueba[]) =>
  crearEscenario((almacen) => new UnidadDeTrabajoEnMemoria(almacen), productos)
const unidades = (n: number) => Cantidad.deEntero(n)
const kilos = (texto: string) => Cantidad.deTexto(texto, 'KILO')

describe('conteo guiado', () => {
  it('RN-OP-21: recorre los productos y resume al terminar', async () => {
    const { modulo, ultima, stock } = await escenario()
    const inicio = await modulo.iniciarConteoGuiado()
    expect(inicio).toEqual({
      producto: {
        id: 'carbon',
        nombre: 'Carbón',
        unidad: 'KILO',
        stock: kilos('10'),
        tieneFoto: false,
      },
      progreso: 'Llevas 0 de 3',
      terminado: false,
      resumen: null,
    })

    const segundo = await modulo.responderConteo('10')
    expect(segundo.producto?.nombre).toBe('Detergente a granel')
    expect(segundo.progreso).toBe('Llevas 1 de 3')

    const tercero = await modulo.saltarEnConteo()
    expect(tercero.producto?.nombre).toBe('Lejía 1 L')
    expect(tercero.progreso).toBe('Llevas 2 de 3')

    const final = await modulo.responderConteo('8')
    expect(await ultima()).toMatchObject({
      tipo: 'AJUSTE',
      motivo: MOTIVO_CONTEO,
      movimientos: [{ productoId: 'lejia', cantidad: -2000, costoUnitario: 240 }],
    })
    expect(await stock('lejia')).toEqual(unidades(8))
    expect(final).toEqual({
      producto: null,
      progreso: 'Llevas 3 de 3',
      terminado: true,
      resumen: [
        'Contaste 2 productos. 1 con diferencia: -S/ 4.80',
        'Te faltó contar 1: Detergente a granel',
      ],
    })
    expect(await modulo.conteoActual()).toBeNull()
  })

  it('RN-OP-21: el conteo guiado se puede seguir después (aunque se cierre la app)', async () => {
    const { modulo, reabrir } = await escenario()
    await modulo.iniciarConteoGuiado()
    await modulo.responderConteo('10')
    const despues = await reabrir().conteoActual()
    expect(despues?.producto?.nombre).toBe('Detergente a granel')
    expect(despues?.progreso).toBe('Llevas 1 de 3')
    expect(await modulo.conteoActual()).toEqual(despues)
  })

  it('RN-OP-21: un doble toque en la última respuesta no pierde la diferencia', async () => {
    const { modulo, tipos } = await escenario()
    await modulo.iniciarConteoGuiado()
    await modulo.responderConteo('10')
    await modulo.saltarEnConteo()
    const [primera, segunda] = await Promise.all([
      modulo.responderConteo('8'),
      modulo.responderConteo('8'),
    ])
    const esperado = [
      'Contaste 2 productos. 1 con diferencia: -S/ 4.80',
      'Te faltó contar 1: Detergente a granel',
    ]
    expect(primera.resumen).toEqual(esperado)
    expect(segunda.resumen).toEqual(esperado)
    expect(await tipos('lejia')).toEqual(['STOCK_INICIAL', 'AJUSTE'])
  })

  it('RN-OP-21: dos toques rápidos en "Saltar" saltan dos productos', async () => {
    const { modulo } = await escenario()
    await modulo.iniciarConteoGuiado()
    await Promise.all([modulo.saltarEnConteo(), modulo.saltarEnConteo()])
    const actual = await modulo.conteoActual()
    expect(actual?.producto?.nombre).toBe('Lejía 1 L')
    expect(actual?.progreso).toBe('Llevas 2 de 3')
  })

  it('RN-OP-21: responder y saltar a la vez se aplican uno después del otro', async () => {
    const { modulo, tipos } = await escenario()
    await modulo.iniciarConteoGuiado()
    await Promise.all([modulo.responderConteo('9'), modulo.saltarEnConteo()])
    expect(await tipos('carbon')).toEqual(['STOCK_INICIAL', 'AJUSTE'])
    expect((await modulo.conteoActual())?.producto?.nombre).toBe('Lejía 1 L')
  })

  it('RN-OP-21: cada respuesta se registra al momento', async () => {
    const { modulo, stock, tipos } = await escenario()
    await modulo.iniciarConteoGuiado()
    await modulo.responderConteo('12.5')
    expect(await stock('carbon')).toEqual(kilos('12.5'))
    expect(await tipos('carbon')).toEqual(['STOCK_INICIAL', 'AJUSTE'])
  })

  it('RN-OP-21: agrupa por categoría y ordena por nombre; solo productos activos', async () => {
    const { modulo } = await escenario([
      {
        id: 'lejia',
        nombre: 'Lejía 1 L',
        categoria: 'Lejías y desinfectantes',
        unidad: 'UNIDAD',
        compra: '2.40',
        venta: '3.50',
        stock: '10',
      },
      {
        id: 'bolsa',
        nombre: 'Bolsa chica',
        categoria: 'Bolsas',
        unidad: 'UNIDAD',
        compra: '0.05',
        venta: '0.10',
        tieneFoto: true,
      },
      {
        id: 'agua',
        nombre: 'Agua de cal',
        categoria: 'Lejías y desinfectantes',
        unidad: 'LITRO',
        compra: '1.00',
        venta: '2.00',
        stock: '3.5',
      },
      {
        id: 'escoba',
        nombre: 'Escoba',
        categoria: 'Bolsas',
        unidad: 'UNIDAD',
        compra: '6.00',
        venta: '9.00',
        archivado: true,
      },
    ])
    const vistos: string[] = []
    let estado = await modulo.iniciarConteoGuiado()
    expect(estado.producto).toEqual({
      id: 'bolsa',
      nombre: 'Bolsa chica',
      unidad: 'UNIDAD',
      stock: Cantidad.cero(),
      tieneFoto: true,
    })
    while (estado.producto) {
      vistos.push(estado.producto.id)
      estado = await modulo.saltarEnConteo()
    }
    expect(vistos).toEqual(['bolsa', 'agua', 'lejia'])
    expect(estado.resumen).toEqual([
      'Contaste 0 productos. Todo cuadraba.',
      'Te faltó contar 3: Bolsa chica, Agua de cal, Lejía 1 L',
    ])
  })

  it('RN-OP-21: los productos archivados durante el conteo se saltan solos', async () => {
    const { modulo, catalogo } = await escenario()
    await modulo.iniciarConteoGuiado()
    catalogo.archivar('detergente')
    const siguiente = await modulo.responderConteo('10')
    expect(siguiente.producto?.nombre).toBe('Lejía 1 L')
    expect(siguiente.progreso).toBe('Llevas 2 de 3')
    const final = await modulo.responderConteo('10')
    expect(final.resumen).toEqual(['Contaste 2 productos. Todo cuadraba.'])
  })

  it('RN-OP-21: si se archiva el producto que se estaba contando, se pasa al siguiente', async () => {
    const { modulo, catalogo, tipos } = await escenario()
    await modulo.iniciarConteoGuiado()
    catalogo.archivar('carbon')
    expect((await modulo.conteoActual())?.producto?.nombre).toBe('Detergente a granel')
    await modulo.responderConteo('4')
    expect(await tipos('carbon')).toEqual(['STOCK_INICIAL'])
    expect(await tipos('detergente')).toEqual(['STOCK_INICIAL', 'AJUSTE'])
  })

  it('RN-OP-21: si ya no queda nada que contar, responder termina el conteo', async () => {
    const { modulo, catalogo, tipos } = await escenario()
    await modulo.iniciarConteoGuiado()
    await modulo.responderConteo('10')
    await modulo.saltarEnConteo()
    catalogo.archivar('lejia')
    const final = await modulo.responderConteo('8')
    expect(final.terminado).toBe(true)
    expect(final.resumen).toEqual([
      'Contaste 1 producto. Todo cuadraba.',
      'Te faltó contar 1: Detergente a granel',
    ])
    expect(await tipos('lejia')).toEqual(['STOCK_INICIAL'])
    expect(await modulo.conteoActual()).toBeNull()
  })

  it('RN-OP-21: si se archiva todo lo que faltaba, saltar termina el conteo', async () => {
    const { modulo, catalogo } = await escenario()
    await modulo.iniciarConteoGuiado()
    catalogo.archivar('carbon')
    catalogo.archivar('detergente')
    catalogo.archivar('lejia')
    const final = await modulo.saltarEnConteo()
    expect(final).toMatchObject({ terminado: true, producto: null })
  })

  it('RN-OP-16 / RN-OP-21: una respuesta inválida no avanza el conteo', async () => {
    const { modulo } = await escenario()
    await modulo.iniciarConteoGuiado()
    await expect(modulo.responderConteo('-1')).rejects.toThrow(
      'La cantidad contada no puede ser negativa',
    )
    expect((await modulo.conteoActual())?.producto?.id).toBe('carbon')
  })

  it('RN-OP-06: si registrar el ajuste falla, el conteo no avanza', async () => {
    const { modulo, proyeccion, stock } = await escenario()
    await modulo.iniciarConteoGuiado()
    proyeccion.fallarAlRegistrar = true
    await expect(modulo.responderConteo('7')).rejects.toThrow('La proyección falló')
    expect((await modulo.conteoActual())?.progreso).toBe('Llevas 0 de 3')
    expect(await stock('carbon')).toEqual(kilos('10'))
  })

  it('RN-OP-21: empezar de nuevo reemplaza el conteo anterior', async () => {
    const { modulo } = await escenario()
    await modulo.iniciarConteoGuiado()
    await modulo.saltarEnConteo()
    const nuevo = await modulo.iniciarConteoGuiado()
    expect(nuevo.progreso).toBe('Llevas 0 de 3')
    expect(nuevo.producto?.id).toBe('carbon')
  })

  it('RN-OP-21: sin productos activos, el conteo termina enseguida', async () => {
    const { modulo } = await escenario([])
    expect(await modulo.iniciarConteoGuiado()).toEqual({
      producto: null,
      progreso: 'Llevas 0 de 0',
      terminado: true,
      resumen: ['Contaste 0 productos. Todo cuadraba.'],
    })
  })

  it('sin conteo en curso no hay nada que continuar, responder ni saltar', async () => {
    const { modulo } = await escenario()
    expect(await modulo.conteoActual()).toBeNull()
    await expect(modulo.responderConteo('1')).rejects.toThrow('No hay un conteo guiado en curso')
    await expect(modulo.saltarEnConteo()).rejects.toThrow('No hay un conteo guiado en curso')
  })

  it('el resumen muestra el id de un producto que el catálogo ya no conoce', async () => {
    const { modulo, catalogo } = await escenario()
    await modulo.iniciarConteoGuiado()
    await modulo.saltarEnConteo()
    catalogo.olvidar('carbon')
    await modulo.saltarEnConteo()
    const final = await modulo.saltarEnConteo()
    expect(final.resumen?.[1]).toBe('Te faltó contar 3: carbon, Detergente a granel, Lejía 1 L')
  })
})
