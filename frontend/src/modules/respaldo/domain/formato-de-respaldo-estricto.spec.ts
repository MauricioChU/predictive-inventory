import { describe, expect, it } from 'vitest'
import type { OperacionRegistro, ProductoRegistro } from '../../../shared/contratos/registros'
import { crearRespaldo, leerRespaldo } from './formato-de-respaldo'

const INVALIDA = 'Este archivo no es una copia válida de la app'

function operacion(parciales: Partial<OperacionRegistro>): OperacionRegistro {
  return {
    id: 'op-1',
    tipo: 'VENTA',
    movimientos: [],
    productoIds: [],
    ocurridaEn: '2026-10-15T20:30:00.000Z',
    registradaEn: '2026-10-15T20:30:00.000Z',
    motivo: null,
    nota: null,
    anulaA: null,
    dispositivoId: 'dispositivo-1',
    ...parciales,
  }
}

function producto(): ProductoRegistro {
  return {
    id: 'prod-1',
    nombre: 'Lejía 1 L',
    nombreNormalizado: 'lejia 1 l',
    categoriaId: 'cat-1',
    unidad: 'UNIDAD',
    precioCompra: 240,
    precioVenta: 350,
    stockMinimo: 3000,
    tieneFoto: false,
    estado: 'ACTIVO',
    creadoEn: '2026-10-01T00:00:00.000Z',
    actualizadoEn: '2026-10-01T00:00:00.000Z',
  }
}

function mov(cantidad: number, precioUnitario: number | null = null) {
  return { productoId: 'prod-1', cantidad, costoUnitario: 240, precioUnitario }
}

function respaldoValido() {
  return crearRespaldo(
    {
      configuracion: {
        clave: 'negocio',
        nombreTienda: 'Bodega Rosita',
        diasEntreCompras: 7,
        diasAnticipacion: 3,
        diasMaximosDeCompra: 30,
        tamanoDeLetra: 'GRANDE',
        notificacionesActivas: false,
      },
      categorias: [{ id: 'cat-1', nombre: 'Otros', nombreNormalizado: 'otros' }],
      productos: [producto()],
      operaciones: [
        operacion({ id: 'op-stock', tipo: 'STOCK_INICIAL', movimientos: [mov(2000)] }),
        operacion({ id: 'op-venta', tipo: 'VENTA', movimientos: [mov(-500, 350)] }),
        operacion({
          id: 'op-anula',
          tipo: 'ANULACION',
          anulaA: 'op-venta',
          movimientos: [mov(500)],
        }),
      ],
      avisos: [{ productoId: 'prod-1', ultimoEstadoAvisado: 'NORMAL' }],
      fotos: [{ productoId: 'prod-1', tipo: 'image/png', base64: 'AAAA' }],
    },
    '2026-10-15T20:30:00-05:00',
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Plano = Record<string, any>

function clon(): Plano {
  return JSON.parse(JSON.stringify(respaldoValido())) as Plano
}

describe('leerRespaldo: versión', () => {
  it.each([0, -1, 0.5])('RN-RE-05: la versión %s no es un entero desde 1', (version) => {
    expect(() => leerRespaldo(JSON.stringify({ ...clon(), versionDeFormato: version }))).toThrow(
      INVALIDA,
    )
  })
})

const INSTANTES_INVALIDOS = [
  '1',
  'x 1',
  'March 7',
  '2026-02-30T10:00:00Z',
  '2026-10-15',
  '2026-10-15 10:00:00',
  '2026-10-15T24:00:00Z',
  '2026-10-15T10:60:00Z',
  '1999-12-31T23:59:59Z',
  '2101-01-01T00:00:00Z',
  '+275760-09-13T00:00:00.000Z',
]

describe('leerRespaldo: instantes estrictos', () => {
  const campos: [string, (r: Plano, v: string) => void][] = [
    ['creadoEn', (r, v) => (r.creadoEn = v)],
    ['ocurridaEn', (r, v) => (r.datos.operaciones[0].ocurridaEn = v)],
    ['registradaEn', (r, v) => (r.datos.operaciones[0].registradaEn = v)],
    ['producto.creadoEn', (r, v) => (r.datos.productos[0].creadoEn = v)],
    ['producto.actualizadoEn', (r, v) => (r.datos.productos[0].actualizadoEn = v)],
  ]

  it.each(campos.flatMap(([c, f]) => INSTANTES_INVALIDOS.map((v) => [c, f, v] as const)))(
    '%s rechaza "%s"',
    (_campo, poner, valor) => {
      const r = clon()
      poner(r, valor)
      expect(() => leerRespaldo(JSON.stringify(r))).toThrow(INVALIDA)
    },
  )

  it.each(['2026-10-15T20:30:00-05:00', '2026-10-16T01:30:00Z', '2026-10-16T01:30:00.123Z'])(
    'acepta "%s"',
    (valor) => {
      const r = clon()
      r.datos.operaciones[0].ocurridaEn = valor
      expect(() => leerRespaldo(JSON.stringify(r))).not.toThrow()
    },
  )
})

describe('leerRespaldo: fotos', () => {
  it.each<[string, (r: Plano) => void]>([
    ['base64 con caracteres ajenos', (r) => (r.datos.fotos[0].base64 = 'no es base64!')],
    ['base64 con largo que no es múltiplo de 4', (r) => (r.datos.fotos[0].base64 = 'AAA')],
    ['base64 con relleno mal puesto', (r) => (r.datos.fotos[0].base64 = 'A=AA')],
    ['base64 vacío', (r) => (r.datos.fotos[0].base64 = '')],
    ['tipo image/gif', (r) => (r.datos.fotos[0].tipo = 'image/gif')],
    ['tipo text/html', (r) => (r.datos.fotos[0].tipo = 'text/html')],
  ])('rechaza %s', (_nombre, danar) => {
    const r = clon()
    danar(r)
    expect(() => leerRespaldo(JSON.stringify(r))).toThrow(INVALIDA)
  })

  it.each(['image/webp', 'image/jpeg', 'image/png'])('acepta %s con relleno válido', (tipo) => {
    const r = clon()
    r.datos.fotos[0] = { productoId: 'prod-1', tipo, base64: 'QUJDRA==' }
    expect(() => leerRespaldo(JSON.stringify(r))).not.toThrow()
  })
})

describe('leerRespaldo: invariantes del libro', () => {
  // Ola 3 (integración): la app guarda la configuración con el nombre vacío de
  // CONFIGURACION_INICIAL si se cambia algo (p. ej. las notificaciones) antes de la primera vez.
  // Una copia de ese estado la generó la propia app: tiene que poder restaurarse.
  it('RN-RE-03: acepta la copia de una tienda que todavía no tiene nombre (configuración inicial)', () => {
    const r = clon()
    r.datos.configuracion.nombreTienda = ''
    expect(leerRespaldo(JSON.stringify(r)).datos.configuracion?.nombreTienda).toBe('')
  })

  it('el respaldo de referencia (con venta y anulación) es válido', () => {
    expect(() => leerRespaldo(JSON.stringify(clon()))).not.toThrow()
  })

  it.each<[string, (r: Plano) => void]>([
    [
      'productos con id repetido',
      (r) => {
        r.datos.productos.push({ ...r.datos.productos[0] })
        r.control.productos = 2
      },
    ],
    ['categorías con id repetido', (r) => r.datos.categorias.push({ ...r.datos.categorias[0] })],
    [
      'operaciones con id repetido',
      (r) => {
        r.datos.operaciones.push({ ...r.datos.operaciones[0] })
        r.control.operaciones = 4
      },
    ],
    ['avisos del mismo producto', (r) => r.datos.avisos.push({ ...r.datos.avisos[0] })],
    ['fotos del mismo producto', (r) => r.datos.fotos.push({ ...r.datos.fotos[0] })],
    ['operación sin movimientos', (r) => (r.datos.operaciones[0].movimientos = [])],
    ['VENTA sin precio', (r) => (r.datos.operaciones[1].movimientos[0].precioUnitario = null)],
    ['VENTA con precio 0', (r) => (r.datos.operaciones[1].movimientos[0].precioUnitario = 0)],
    [
      'INGRESO con precio de venta',
      (r) => {
        r.datos.operaciones[0].tipo = 'INGRESO'
        r.datos.operaciones[0].movimientos[0].precioUnitario = 350
      },
    ],
    ['ANULACION sin anulaA', (r) => (r.datos.operaciones[2].anulaA = null)],
    [
      'ANULACION de una operación inexistente',
      (r) => (r.datos.operaciones[2].anulaA = 'no-existe'),
    ],
    ['VENTA con anulaA', (r) => (r.datos.operaciones[1].anulaA = 'op-stock')],
    [
      'movimiento de un producto inexistente',
      (r) => (r.datos.operaciones[0].movimientos[0].productoId = 'fantasma'),
    ],
    ['aviso de un producto inexistente', (r) => (r.datos.avisos[0].productoId = 'fantasma')],
    ['foto de un producto inexistente', (r) => (r.datos.fotos[0].productoId = 'fantasma')],
    ['producto con categoría inexistente', (r) => (r.datos.productos[0].categoriaId = 'fantasma')],
    ['precio de compra negativo', (r) => (r.datos.productos[0].precioCompra = -1)],
    ['precio de venta 0', (r) => (r.datos.productos[0].precioVenta = 0)],
    ['stock mínimo negativo', (r) => (r.datos.productos[0].stockMinimo = -1)],
    [
      'nombre de tienda de más de 40 letras',
      (r) => (r.datos.configuracion.nombreTienda = 'a'.repeat(41)),
    ],
    ['días entre compras fuera de rango', (r) => (r.datos.configuracion.diasEntreCompras = 61)],
    ['días de anticipación fuera de rango', (r) => (r.datos.configuracion.diasAnticipacion = 0)],
    [
      'días máximos de compra fuera de rango',
      (r) => (r.datos.configuracion.diasMaximosDeCompra = 181),
    ],
    [
      'stock que sumaría menos de cero',
      (r) => (r.datos.operaciones[1].movimientos[0].cantidad = -9000),
    ],
  ])('rechaza %s', (_nombre, danar) => {
    const r = clon()
    danar(r)
    expect(() => leerRespaldo(JSON.stringify(r))).toThrow(INVALIDA)
  })
})
