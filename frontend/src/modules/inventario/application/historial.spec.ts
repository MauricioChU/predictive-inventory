import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { instanteLocal } from '@/shared/domain/fecha'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { UnidadDeTrabajoEspia } from '@/shared/application/__pruebas__/unidad-de-trabajo-espia'
import { crearEscenario } from '../__pruebas__/escenario'

const escenario = () => crearEscenario((almacen) => new UnidadDeTrabajoEnMemoria(almacen))
const soles = (texto: string) => Dinero.deTexto(texto)

describe('historial', () => {
  it('RN-OP-01: el historial de un producto va del más reciente al más antiguo', async () => {
    const { modulo } = await escenario()
    await modulo.registrarVenta({ lineas: [{ productoId: 'lejia', cantidad: '3' }] })
    await modulo.registrarIngreso({
      lineas: [{ productoId: 'lejia', cantidad: '6', costo: '2.40' }],
    })
    const tipos = (await modulo.historial({ productoId: 'lejia' })).map((o) => o.tipo)
    expect(tipos).toEqual(['INGRESO', 'VENTA', 'STOCK_INICIAL'])
    expect([...tipos].reverse()).toEqual(['STOCK_INICIAL', 'VENTA', 'INGRESO'])
  })

  it('HU-OP-07: una venta anotada con fecha de ayer se ordena por cuándo ocurrió', async () => {
    const { modulo, reloj } = await escenario()
    reloj.avanzarSegundos(60)
    await modulo.registrarMerma({ productoId: 'lejia', cantidad: '1', motivo: 'Se venció' })
    reloj.avanzarSegundos(60)
    const { operacionId } = await modulo.registrarVenta({
      lineas: [{ productoId: 'lejia', cantidad: '1' }],
      ocurridaEn: instanteLocal('2026-10-14 18:30'),
    })
    const vistas = await modulo.historial({ productoId: 'lejia' })
    expect(vistas.map((o) => o.tipo)).toEqual(['MERMA', 'STOCK_INICIAL', 'VENTA'])
    expect(vistas.at(-1)?.id).toBe(operacionId)
  })

  it('RN-OP-02 / RN-OP-17: marca las operaciones anuladas y muestra la anulación', async () => {
    const { modulo } = await escenario()
    const { operacionId } = await modulo.registrarVenta({
      lineas: [{ productoId: 'lejia', cantidad: '2' }],
    })
    const { anulacionId } = await modulo.anularOperacion({
      operacionId,
      motivo: 'Me equivoqué',
    })
    const [anulacion, venta, inicial] = await modulo.historial({ productoId: 'lejia' })
    expect(anulacion).toMatchObject({
      id: anulacionId,
      tipo: 'ANULACION',
      etiqueta: 'Anulado',
      anulada: false,
      anulaA: operacionId,
      motivo: 'Me equivoqué',
      total: null,
    })
    expect(venta).toMatchObject({
      id: operacionId,
      tipo: 'VENTA',
      etiqueta: 'Venta',
      anulada: true,
    })
    expect(inicial).toMatchObject({
      tipo: 'STOCK_INICIAL',
      etiqueta: 'Stock inicial',
      anulada: false,
    })
  })

  it('RN-OP-10 / RN-OP-12: la vista de una venta trae sus líneas con nombre, importe y ganancia', async () => {
    const { modulo } = await escenario()
    const { operacionId } = await modulo.registrarVenta({
      lineas: [
        { productoId: 'lejia', cantidad: '2' },
        { productoId: 'carbon', cantidad: '1.25' },
        { productoId: 'detergente', cantidad: '0.333' },
      ],
      nota: 'Cliente de siempre',
    })
    const [venta] = await modulo.historial({ tipo: 'VENTA' })
    expect(venta).toEqual({
      id: operacionId,
      tipo: 'VENTA',
      etiqueta: 'Venta',
      ocurridaEn: instanteLocal('2026-10-15 10:00'),
      lineas: [
        {
          productoId: 'lejia',
          nombre: 'Lejía 1 L',
          unidad: 'UNIDAD',
          cantidad: Cantidad.deEntero(-2),
          precioUnitario: soles('3.50'),
          costoUnitario: soles('2.40'),
          importe: soles('7.00'),
          ganancia: soles('2.20'),
        },
        {
          productoId: 'carbon',
          nombre: 'Carbón',
          unidad: 'KILO',
          cantidad: Cantidad.deTexto('-1.25', 'KILO'),
          precioUnitario: soles('4.00'),
          costoUnitario: soles('2.75'),
          importe: soles('5.00'),
          ganancia: soles('1.56'),
        },
        {
          productoId: 'detergente',
          nombre: 'Detergente a granel',
          unidad: 'KILO',
          cantidad: Cantidad.deTexto('-0.333', 'KILO'),
          precioUnitario: soles('7.90'),
          costoUnitario: soles('5.30'),
          importe: soles('2.63'),
          ganancia: soles('0.87'),
        },
      ],
      total: soles('14.63'),
      ganancia: soles('4.63'),
      anulada: false,
      anulaA: null,
      motivo: null,
      nota: 'Cliente de siempre',
    })
  })

  it('las etiquetas de merma y ajuste dicen qué pasó; sin precio no hay importe', async () => {
    const { modulo } = await escenario()
    await modulo.registrarMerma({ productoId: 'carbon', cantidad: '1', motivo: 'Se derramó' })
    await modulo.contarStock({ productoId: 'carbon', contado: '8' })
    await modulo.consultable.retirarStock('carbon')
    const vistas = await modulo.historial({ productoId: 'carbon' })
    expect(vistas.map((o) => o.etiqueta)).toEqual([
      'Producto retirado',
      'Conteo de stock',
      'Se derramó',
      'Stock inicial',
    ])
    expect(vistas[2]?.lineas[0]).toMatchObject({
      importe: null,
      ganancia: null,
      precioUnitario: null,
    })
    expect(vistas[2]?.total).toBeNull()
  })

  it('sin filtro trae todo; con filtro de tipo y producto, solo lo pedido', async () => {
    const { modulo } = await escenario()
    await modulo.registrarVenta({ lineas: [{ productoId: 'lejia', cantidad: '1' }] })
    await modulo.registrarVenta({ lineas: [{ productoId: 'carbon', cantidad: '1' }] })
    expect(await modulo.historial()).toHaveLength(5)
    expect((await modulo.historial({ tipo: 'VENTA' })).map((o) => o.lineas[0]?.productoId)).toEqual(
      ['carbon', 'lejia'],
    )
    expect(
      (await modulo.historial({ tipo: 'VENTA', productoId: 'lejia' })).map((o) => o.tipo),
    ).toEqual(['VENTA'])
  })

  it('un producto que el catálogo ya no conoce se muestra con su id', async () => {
    const { modulo, catalogo } = await escenario()
    catalogo.olvidar('detergente')
    const [inicial] = await modulo.historial({ productoId: 'detergente' })
    expect(inicial?.lineas[0]).toMatchObject({ nombre: 'detergente', unidad: 'UNIDAD' })
  })
})

describe('ultimoIngresoDe', () => {
  it('RN-AN-16: la última vez que llegó mercadería, ignorando los ingresos anulados', async () => {
    const { modulo, reloj } = await escenario()
    expect(await modulo.consultable.ultimoIngresoDe('lejia')).toBeNull()
    const primero = await modulo.registrarIngreso({
      lineas: [{ productoId: 'lejia', cantidad: '1', costo: '2.40' }],
      ocurridaEn: instanteLocal('2026-10-13 09:00'),
    })
    reloj.avanzarSegundos(60)
    const segundo = await modulo.registrarIngreso({
      lineas: [{ productoId: 'lejia', cantidad: '1', costo: '2.40' }],
      ocurridaEn: instanteLocal('2026-10-14 09:00'),
    })
    await modulo.registrarIngreso({
      lineas: [{ productoId: 'lejia', cantidad: '1', costo: '2.40' }],
      ocurridaEn: instanteLocal('2026-10-12 09:00'),
    })
    expect(await modulo.consultable.ultimoIngresoDe('lejia')).toBe(
      instanteLocal('2026-10-14 09:00'),
    )
    const segundoId = segundo.tipo === 'hecho' ? segundo.operacionId : ''
    await modulo.anularOperacion({ operacionId: segundoId })
    expect(await modulo.consultable.ultimoIngresoDe('lejia')).toBe(
      instanteLocal('2026-10-13 09:00'),
    )
    expect(primero.tipo).toBe('hecho')
  })
})

describe('RN-SIS-09: el historial lee en una sola transacción de solo lectura', () => {
  it.each([
    ['de toda la tienda', {}],
    ['de un producto', { productoId: 'lejia' }],
  ])('RN-SIS-09: el historial %s lee dentro de UN leer y no abre escrituras', async (_, filtro) => {
    let espia!: UnidadDeTrabajoEspia
    const { modulo } = await crearEscenario(
      (almacen) => (espia = new UnidadDeTrabajoEspia(new UnidadDeTrabajoEnMemoria(almacen))),
    )
    await modulo.registrarVenta({ lineas: [{ productoId: 'lejia', cantidad: '1' }] })
    espia.reiniciar()
    expect((await modulo.historial(filtro)).length).toBeGreaterThan(0)
    expect(espia.transacciones()).toEqual({ lecturas: 1, escrituras: 0 })
  })
})

describe('operación por id (plan 12, detalle del Historial)', () => {
  it('HU-OP-08: devuelve la misma vista que el historial, sin leer todo el libro', async () => {
    const { modulo } = await escenario()
    const { operacionId } = await modulo.registrarVenta({
      lineas: [{ productoId: 'lejia', cantidad: '2' }],
    })
    const [enElHistorial] = await modulo.historial({ tipo: 'VENTA' })
    expect(await modulo.operacion(operacionId)).toEqual(enElHistorial)
  })

  it('RN-OP-17: dice si está anulada; una anulación trae a quién anula', async () => {
    const { modulo } = await escenario()
    const { operacionId } = await modulo.registrarVenta({
      lineas: [{ productoId: 'lejia', cantidad: '2' }],
    })
    const { anulacionId } = await modulo.anularOperacion({ operacionId })
    expect((await modulo.operacion(operacionId))?.anulada).toBe(true)
    expect(await modulo.operacion(anulacionId)).toMatchObject({
      tipo: 'ANULACION',
      anulaA: operacionId,
      anulada: false,
    })
  })

  it('una operación que no existe es null', async () => {
    const { modulo } = await escenario()
    expect(await modulo.operacion('no-existe')).toBeNull()
  })

  it('RN-SIS-09: lee dentro de UN leer y no abre escrituras', async () => {
    let espia!: UnidadDeTrabajoEspia
    const { modulo } = await crearEscenario(
      (almacen) => (espia = new UnidadDeTrabajoEspia(new UnidadDeTrabajoEnMemoria(almacen))),
    )
    const { operacionId } = await modulo.registrarVenta({
      lineas: [{ productoId: 'lejia', cantidad: '1' }],
    })
    espia.reiniciar()
    expect(await modulo.operacion(operacionId)).not.toBeNull()
    expect(espia.transacciones()).toEqual({ lecturas: 1, escrituras: 0 })
  })
})

describe('plan 17: el Historial de a páginas (sin leer todo el libro)', () => {
  /** Ventas, una merma, una anulación y una venta "de ayer", con el reloj avanzando. */
  async function conMovimientos() {
    const esc = await escenario()
    const { modulo, reloj } = esc
    for (let i = 0; i < 4; i += 1) {
      reloj.avanzarSegundos(60)
      await modulo.registrarVenta({ lineas: [{ productoId: 'lejia', cantidad: '1' }] })
    }
    reloj.avanzarSegundos(60)
    await modulo.registrarMerma({ productoId: 'lejia', cantidad: '1', motivo: 'Se venció' })
    reloj.avanzarSegundos(60)
    const { operacionId } = await modulo.registrarVenta({
      lineas: [{ productoId: 'lejia', cantidad: '2' }],
    })
    reloj.avanzarSegundos(60)
    await modulo.anularOperacion({ operacionId, motivo: 'Me equivoqué' })
    reloj.avanzarSegundos(60)
    await modulo.registrarVenta({
      lineas: [{ productoId: 'lejia', cantidad: '1' }],
      ocurridaEn: instanteLocal('2026-10-14 18:30'),
    })
    return esc
  }

  async function todasLasPaginas(
    modulo: Awaited<ReturnType<typeof escenario>>['modulo'],
    consulta: { tipo?: 'VENTA' | 'MERMA'; cuantas: number },
  ) {
    const vistas = []
    let paginas = 0
    let desde: string | undefined
    do {
      const pagina = await modulo.paginaDelHistorial({ ...consulta, ...(desde ? { desde } : {}) })
      vistas.push(...pagina.operaciones)
      paginas += 1
      desde = pagina.siguiente ?? undefined
    } while (desde !== undefined)
    return { vistas, paginas }
  }

  it('HU-OP-08: página tras página da lo mismo que el historial completo, en el mismo orden', async () => {
    const { modulo } = await conMovimientos()
    const completo = await modulo.historial()
    const { vistas, paginas } = await todasLasPaginas(modulo, { cuantas: 3 })
    expect(vistas).toEqual(completo)
    expect(paginas).toBeGreaterThan(2)
    // La anulada viene marcada aunque su anulación esté en otra página (RN-OP-17).
    expect(vistas.filter((o) => o.anulada)).toHaveLength(1)
  })

  it('con filtro por tipo, igual que el historial filtrado', async () => {
    const { modulo } = await conMovimientos()
    const { vistas } = await todasLasPaginas(modulo, { tipo: 'VENTA', cuantas: 2 })
    expect(vistas).toEqual(await modulo.historial({ tipo: 'VENTA' }))
  })

  it('la primera página trae solo las más recientes y dice desde dónde seguir', async () => {
    const { modulo } = await conMovimientos()
    const pagina = await modulo.paginaDelHistorial({ cuantas: 2 })
    expect(pagina.operaciones.map((o) => o.tipo)).toEqual(['ANULACION', 'VENTA'])
    expect(pagina.siguiente).toBe(pagina.operaciones.at(-1)?.ocurridaEn)
  })

  it('RN-SIS-09: cada página se lee dentro de UN leer y no abre escrituras', async () => {
    let espia!: UnidadDeTrabajoEspia
    const { modulo } = await crearEscenario(
      (almacen) => (espia = new UnidadDeTrabajoEspia(new UnidadDeTrabajoEnMemoria(almacen))),
    )
    await modulo.registrarVenta({ lineas: [{ productoId: 'lejia', cantidad: '1' }] })
    espia.reiniciar()
    expect((await modulo.paginaDelHistorial({ cuantas: 60 })).operaciones.length).toBeGreaterThan(0)
    expect(espia.transacciones()).toEqual({ lecturas: 1, escrituras: 0 })
  })
})
