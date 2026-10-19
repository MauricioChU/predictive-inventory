import { describe, expect, it } from 'vitest'
import type { OperacionVista } from '@/modules/inventario'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { instanteLocal } from '@/shared/domain/fecha'
import type { ProductoVista } from '../../application/modulo'
import {
  aFilaDeLista,
  barrasDeTendencia,
  filtrarProductos,
  horaDe,
  montoParaEditar,
  movimientoDeProducto,
  retiradoAlArchivar,
  textoDeConteo,
  vacioDeLista,
} from '../presentacion'

function producto(cambios: Partial<ProductoVista> = {}): ProductoVista {
  const precioCompra = Dinero.deTexto('2.40')
  const precioVenta = Dinero.deTexto('3.50')
  return {
    id: 'p-1',
    nombre: 'Lejía 1 L',
    categoriaId: 'c-lejias',
    categoriaNombre: 'Lejías y desinfectantes',
    unidad: 'UNIDAD',
    precioCompra,
    precioVenta,
    gananciaPorUnidad: precioVenta.restar(precioCompra),
    stockMinimo: Cantidad.deEntero(3),
    stock: Cantidad.deEntero(12),
    activo: true,
    tieneFoto: false,
    ...cambios,
  }
}

describe('aFilaDeLista (fila de Productos: foto, nombre, stock con unidad, estado)', () => {
  it('un producto activo muestra su stock con unidad, su precio y su estado', () => {
    const foto = new Blob(['x'], { type: 'image/webp' })
    expect(aFilaDeLista(producto(), 'POR_ACABARSE', foto)).toEqual({
      id: 'p-1',
      nombre: 'Lejía 1 L',
      imagen: foto,
      categoria: 'Lejías y desinfectantes',
      textoStock: '12 unid.',
      textoPrecio: 'S/ 3.50',
      estado: 'POR_ACABARSE',
      textoSecundario: undefined,
    })
  })

  it('un producto por kilo dice "kg" y uno sin foto no lleva imagen', () => {
    const carbon = producto({ unidad: 'KILO', stock: Cantidad.deTexto('2.5', 'KILO') })
    const fila = aFilaDeLista(carbon, 'NORMAL', undefined)
    expect(fila.textoStock).toBe('2.5 kg')
    expect(fila.imagen).toBeUndefined()
  })

  it('RN-CAT-10: un archivado no tiene estado de stock y lo dice con texto', () => {
    const fila = aFilaDeLista(
      producto({ activo: false, stock: Cantidad.cero() }),
      undefined,
      undefined,
    )
    expect(fila.estado).toBeUndefined()
    expect(fila.textoSecundario).toBe('Archivado')
  })
})

describe('filtrarProductos (Todos · Se acaban · Queda poco · Agotados · Archivados, y categoría)', () => {
  const lejia = producto({ id: 'lejia' })
  const carbon = producto({ id: 'carbon', categoriaId: 'c-carbon' })
  const bolsa = producto({ id: 'bolsa', categoriaId: 'c-carbon' })
  const estados = new Map([
    ['lejia', 'POR_ACABARSE' as const],
    ['carbon', 'AGOTADO' as const],
    ['bolsa', 'NORMAL' as const],
  ])
  const todos = [lejia, carbon, bolsa]

  it('Todos y Archivados no filtran por estado (los archivados ya vienen aparte)', () => {
    expect(filtrarProductos(todos, { estado: 'TODOS', categoriaId: '', estados })).toEqual(todos)
    expect(filtrarProductos(todos, { estado: 'ARCHIVADOS', categoriaId: '', estados })).toEqual(
      todos,
    )
  })

  it('"Queda poco" deja los por acabarse y "Agotados" los agotados', () => {
    expect(
      filtrarProductos(todos, { estado: 'POR_ACABARSE', categoriaId: '', estados }).map(
        (p) => p.id,
      ),
    ).toEqual(['lejia'])
    expect(
      filtrarProductos(todos, { estado: 'AGOTADO', categoriaId: '', estados }).map((p) => p.id),
    ).toEqual(['carbon'])
  })

  it('RN-CAT-16: "Se acaban" deja agotados y por acabarse, sin los que tienen stock', () => {
    expect(
      filtrarProductos(todos, { estado: 'SE_ACABAN', categoriaId: '', estados }).map((p) => p.id),
    ).toEqual(['lejia', 'carbon'])
    expect(
      filtrarProductos(todos, { estado: 'SE_ACABAN', categoriaId: 'c-carbon', estados }).map(
        (p) => p.id,
      ),
    ).toEqual(['carbon'])
  })

  it('la categoría se combina con el estado', () => {
    expect(
      filtrarProductos(todos, { estado: 'TODOS', categoriaId: 'c-carbon', estados }).map(
        (p) => p.id,
      ),
    ).toEqual(['carbon', 'bolsa'])
    expect(
      filtrarProductos(todos, { estado: 'AGOTADO', categoriaId: 'c-lejias', estados }),
    ).toEqual([])
  })
})

describe('textoDeConteo', () => {
  it('singular y plural', () => {
    expect(textoDeConteo(1)).toBe('1 producto')
    expect(textoDeConteo(12)).toBe('12 productos')
    expect(textoDeConteo(1500)).toBe('1 500 productos')
  })
})

describe('vacioDeLista (RN-UX-10: dice por qué está vacía y ofrece la acción siguiente)', () => {
  const base = { hayProductos: true, texto: '', estado: 'TODOS' as const, categoriaNombre: null }

  it('sin ningún producto: "Aún no tienes productos" → Agregar el primero', () => {
    expect(vacioDeLista({ ...base, hayProductos: false })).toEqual({
      titulo: 'Aún no tienes productos',
      descripcion: 'Agrega tu primer producto con su nombre, su precio y su foto.',
      accion: 'Agregar el primero',
      tipoDeAccion: 'agregar',
    })
  })

  it('una búsqueda sin resultados ofrece agregarlo como producto nuevo', () => {
    expect(vacioDeLista({ ...base, texto: 'shampoo' })).toEqual({
      titulo: 'No encontramos «shampoo»',
      descripcion: 'Revisa cómo está escrito o agrégalo como producto nuevo.',
      accion: 'Agregar producto',
      tipoDeAccion: 'agregar',
    })
  })

  it('una búsqueda sin resultados con un filtro puesto ofrece buscar en todos', () => {
    expect(vacioDeLista({ ...base, texto: 'lejia', estado: 'AGOTADO' })).toEqual({
      titulo: 'No encontramos «lejia» con este filtro',
      descripcion: 'Puede estar en otro grupo de productos.',
      accion: 'Buscar en todos',
      tipoDeAccion: 'ver-todos',
    })
  })

  it('cada filtro de estado explica por qué no hay nada', () => {
    expect(vacioDeLista({ ...base, estado: 'POR_ACABARSE' })).toMatchObject({
      titulo: 'Ningún producto queda poco',
      descripcion: 'Por ahora ninguno se está acabando.',
      accion: 'Ver todos',
      tipoDeAccion: 'ver-todos',
    })
    expect(vacioDeLista({ ...base, estado: 'SE_ACABAN' })).toMatchObject({
      titulo: 'No se acaba ningún producto',
      descripcion: 'Por ahora todos tienen stock suficiente.',
      accion: 'Ver todos',
      tipoDeAccion: 'ver-todos',
    })
    expect(vacioDeLista({ ...base, estado: 'AGOTADO' })).toMatchObject({
      titulo: 'No tienes productos agotados',
      descripcion: 'Todos tienen stock.',
      tipoDeAccion: 'ver-todos',
    })
    expect(vacioDeLista({ ...base, estado: 'ARCHIVADOS' })).toMatchObject({
      titulo: 'No tienes productos archivados',
      descripcion: 'Aquí aparecen los productos que ya no vendes.',
      tipoDeAccion: 'ver-todos',
    })
  })

  it('con productos, pero todos archivados: lo dice y ofrece agregar uno', () => {
    expect(vacioDeLista(base)).toEqual({
      titulo: 'No tienes productos a la venta',
      descripcion: 'Los que ya no vendes están en «Archivados».',
      accion: 'Agregar producto',
      tipoDeAccion: 'agregar',
    })
  })

  it('una categoría sin productos ofrece ver todas', () => {
    expect(vacioDeLista({ ...base, categoriaNombre: 'Bolsas' })).toEqual({
      titulo: 'No tienes productos en Bolsas',
      descripcion: 'Elige otra categoría o agrega un producto nuevo.',
      accion: 'Ver todas las categorías',
      tipoDeAccion: 'ver-todos',
    })
  })
})

describe('montoParaEditar (el precio en el campo, sin "S/")', () => {
  it('dos decimales y sin agrupar los miles', () => {
    expect(montoParaEditar(Dinero.deTexto('2.4'))).toBe('2.40')
    expect(montoParaEditar(Dinero.deTexto('1250'))).toBe('1250.00')
    expect(montoParaEditar(Dinero.cero())).toBe('0.00')
  })
})

// hoyEnLaTienda vive en shared/domain/fecha (un solo ayudante): su prueba está en fecha.spec.
describe('horaDe (zona de la tienda, America/Lima)', () => {
  it('la hora en formato de 12 horas, como se dice en la tienda', () => {
    expect(horaDe(instanteLocal('2026-10-16 10:30'))).toBe('10:30 a. m.')
    expect(horaDe(instanteLocal('2026-10-16 15:05'))).toBe('3:05 p. m.')
    expect(horaDe(instanteLocal('2026-10-16 12:00'))).toBe('12:00 p. m.')
    expect(horaDe(instanteLocal('2026-10-16 00:15'))).toBe('12:15 a. m.')
  })
})

describe('barrasDeTendencia (RN-AN-14: 8 bloques de 7 días completos)', () => {
  const HOY = '2026-10-16'
  const tendencia = [0, 1, 2, 3, 4, 5, 6, 14].map((n) => Cantidad.deEntero(n))

  it('del bloque más antiguo al más reciente, con sus fechas y la cantidad con unidad', () => {
    const barras = barrasDeTendencia(tendencia, 'UNIDAD', HOY)
    expect(barras.map((b) => b.etiqueta)).toEqual([
      '21 al 27 ago',
      '28 ago al 3 set',
      '4 al 10 set',
      '11 al 17 set',
      '18 al 24 set',
      '25 set al 1 oct',
      '2 al 8 oct',
      '9 al 15 oct',
    ])
    expect(barras.at(-1)).toEqual({ etiqueta: '9 al 15 oct', valor: 14000, textoValor: '14 unid.' })
    expect(barras[0]).toEqual({ etiqueta: '21 al 27 ago', valor: 0, textoValor: '0 unid.' })
  })

  it('por kilo, con decimales', () => {
    const barras = barrasDeTendencia(
      [...Array(7).fill(Cantidad.cero()), Cantidad.deTexto('2.5', 'KILO')],
      'KILO',
      HOY,
    )
    expect(barras.at(-1)?.textoValor).toBe('2.5 kg')
  })
})

describe('movimientoDeProducto (últimos movimientos del detalle)', () => {
  const HOY = '2026-10-16'
  function operacion(cambios: Partial<OperacionVista>): OperacionVista {
    return {
      id: 'op-1',
      tipo: 'VENTA',
      etiqueta: 'Venta',
      ocurridaEn: instanteLocal('2026-10-16 10:30'),
      lineas: [
        {
          productoId: 'p-1',
          nombre: 'Lejía 1 L',
          unidad: 'UNIDAD',
          cantidad: Cantidad.deEntero(-2),
          precioUnitario: Dinero.deTexto('3.50'),
          costoUnitario: Dinero.deTexto('2.40'),
          importe: Dinero.deTexto('7.00'),
          ganancia: Dinero.deTexto('2.20'),
        },
      ],
      total: Dinero.deTexto('7.00'),
      ganancia: Dinero.deTexto('2.20'),
      anulada: false,
      anulaA: null,
      motivo: null,
      nota: null,
      ...cambios,
    }
  }

  it('qué pasó, cuándo y cuánto cambió el stock (con signo)', () => {
    expect(movimientoDeProducto(operacion({}), 'p-1', HOY)).toEqual({
      id: 'op-1',
      titulo: 'Venta',
      cuando: 'Hoy, 10:30 a. m.',
      cantidad: '-2 unid.',
    })
  })

  it('lo que entra lleva "+" y los días anteriores se nombran', () => {
    const ingreso = operacion({
      tipo: 'INGRESO',
      etiqueta: 'Llegó mercadería',
      ocurridaEn: instanteLocal('2026-10-15 16:00'),
      lineas: [{ ...operacion({}).lineas[0]!, cantidad: Cantidad.deEntero(12) }],
    })
    expect(movimientoDeProducto(ingreso, 'p-1', HOY)).toMatchObject({
      titulo: 'Llegó mercadería',
      cuando: 'Ayer, 4:00 p. m.',
      cantidad: '+12 unid.',
    })
  })

  it('una operación anulada lo dice', () => {
    expect(movimientoDeProducto(operacion({ anulada: true }), 'p-1', HOY).titulo).toBe(
      'Venta (anulada)',
    )
  })

  it('solo cuenta las líneas de este producto', () => {
    const conOtro = operacion({
      lineas: [
        { ...operacion({}).lineas[0]!, productoId: 'otro', cantidad: Cantidad.deEntero(-5) },
        operacion({}).lineas[0]!,
      ],
    })
    expect(movimientoDeProducto(conOtro, 'p-1', HOY).cantidad).toBe('-2 unid.')
  })
})

describe('retiradoAlArchivar (RN-CAT-11: lo que de verdad se retiró al archivar)', () => {
  function ajuste(motivo: string, cantidad: number): OperacionVista {
    return {
      id: `op-${motivo}`,
      tipo: 'AJUSTE',
      etiqueta: motivo,
      ocurridaEn: instanteLocal('2026-10-16 10:30'),
      lineas: [
        {
          productoId: 'p-1',
          nombre: 'Escoba',
          unidad: 'UNIDAD',
          cantidad: Cantidad.deEntero(cantidad),
          precioUnitario: null,
          costoUnitario: Dinero.deTexto('6.00'),
          importe: null,
          ganancia: null,
        },
      ],
      total: null,
      ganancia: null,
      anulada: false,
      anulaA: null,
      motivo,
      nota: null,
    }
  }

  it('la cantidad (sin signo) del ajuste "Producto retirado" que registró ESTE archivado', () => {
    expect(retiradoAlArchivar([ajuste('Producto retirado', -4)], 'p-1', new Set())).toBe('4 unid.')
  })

  it('null si no hubo retiro (se archivó sin stock)', () => {
    expect(retiradoAlArchivar([ajuste('Conteo de stock', -1)], 'p-1', new Set())).toBeNull()
    expect(retiradoAlArchivar([], 'p-1', new Set())).toBeNull()
  })

  it('un retiro de un archivado anterior no cuenta', () => {
    const viejo = ajuste('Producto retirado', -3)
    expect(retiradoAlArchivar([viejo], 'p-1', new Set([viejo.id]))).toBeNull()
  })
})
