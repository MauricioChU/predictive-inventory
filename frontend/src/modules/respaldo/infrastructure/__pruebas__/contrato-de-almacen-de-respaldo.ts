import { expect, it } from 'vitest'
import type {
  ConfiguracionRegistro,
  EstadoDelSistemaRegistro,
  NombreDeTabla,
  OperacionRegistro,
  ProductoRegistro,
  TablasDeLaApp,
} from '../../../../shared/contratos/registros'
import type { AlmacenDeRespaldo } from '../../application/puertos'
import type { DatosDelRespaldo } from '../../domain/formato-de-respaldo'

/** Un almacén de respaldo con acceso directo a sus tablas, para preparar y revisar los datos. */
export interface EntornoDeAlmacenDeRespaldo {
  almacen: AlmacenDeRespaldo
  /** Escribe registros directamente en una tabla (sin pasar por el almacén). */
  sembrar<K extends NombreDeTabla>(tabla: K, ...registros: TablasDeLaApp[K][]): Promise<void>
  /** Lee una tabla directamente. */
  leer<K extends NombreDeTabla>(tabla: K): Promise<TablasDeLaApp[K][]>
}

export const DATOS_VACIOS: DatosDelRespaldo = {
  configuracion: null,
  categorias: [],
  productos: [],
  operaciones: [],
  avisos: [],
  fotos: [],
}

export const NEGOCIO: ConfiguracionRegistro = {
  clave: 'negocio',
  nombreTienda: 'Bodega Rosita',
  diasEntreCompras: 7,
  diasAnticipacion: 3,
  diasMaximosDeCompra: 30,
  tamanoDeLetra: 'GRANDE',
  notificacionesActivas: false,
  alquilerDelLocal: null,
}

export const SISTEMA: EstadoDelSistemaRegistro = {
  clave: 'sistema',
  dispositivoId: 'dispositivo-1',
  primeraVezCompletada: true,
  ultimoRespaldoEn: '2026-10-01T00:00:00.000Z',
  almacenamientoPersistente: 'CONCEDIDO',
  ultimoResumenDelDiaMostrado: null,
  ultimoPagoDelLocalAvisado: null,
  recordatorioDelLocalCerradoEl: null,
}

export function producto(id: string): ProductoRegistro {
  return {
    id,
    nombre: 'Lejía 1 L',
    nombreNormalizado: 'lejia 1 l',
    categoriaId: 'cat-1',
    unidad: 'UNIDAD' as const,
    precioCompra: 240,
    precioVenta: 350,
    stockMinimo: 3000,
    tieneFoto: true,
    estado: 'ACTIVO' as const,
    creadoEn: '2026-10-01T00:00:00.000Z',
    actualizadoEn: '2026-10-01T00:00:00.000Z',
  }
}

export function operacion(
  id: string,
  registradaEn = '2026-10-01T05:00:00.000Z',
): OperacionRegistro {
  return {
    id,
    tipo: 'STOCK_INICIAL',
    movimientos: [
      { productoId: 'lejia', cantidad: 10000, costoUnitario: 240, precioUnitario: null },
    ],
    productoIds: ['lejia'],
    ocurridaEn: registradaEn,
    registradaEn,
    motivo: null,
    nota: null,
    anulaA: null,
    dispositivoId: 'dispositivo-1',
  }
}

async function sembrarProyecciones(e: EntornoDeAlmacenDeRespaldo): Promise<void> {
  await e.sembrar('existencias', { productoId: 'lejia', cantidad: 10000 })
  await e.sembrar('resumenes', {
    clave: 'lejia|2026-10-15',
    productoId: 'lejia',
    dia: '2026-10-15',
    lineasVendidas: 1,
    cantidadVendida: 1000,
    ventas: 350,
    costoVendido: 240,
    costoMermas: 0,
    valorAjustes: 0,
    cambioNeto: -1000,
  })
  await e.sembrar('listaDeCompras', { dia: '2026-10-15', cambios: [] })
  await e.sembrar('conteo', {
    id: 'actual',
    iniciadoEn: '2026-10-15T00:00:00.000Z',
    orden: [],
    posicion: 0,
    contados: [],
    saltados: [],
    terminadoEn: null,
  })
}

/**
 * Casos de prueba de `AlmacenDeRespaldo`: los mismos para la implementación en memoria y la
 * de Dexie (los resultados deben ser idénticos). `crear` devuelve un almacén vacío.
 */
export function probarAlmacenDeRespaldo(crear: () => EntornoDeAlmacenDeRespaldo): void {
  it('leerTodo devuelve todo vacío al principio', async () => {
    expect(await crear().almacen.leerTodo()).toEqual(DATOS_VACIOS)
  })

  it('leerTodo incluye la configuración del negocio, pero no el estado del sistema', async () => {
    const e = crear()
    await e.sembrar('configuracion', NEGOCIO, SISTEMA)
    const datos = await e.almacen.leerTodo()
    expect(datos.configuracion).toEqual(NEGOCIO)
  })

  it('leerTodo trae categorías, productos, operaciones y avisos tal como están guardados', async () => {
    const e = crear()
    await e.sembrar('categorias', { id: 'cat-1', nombre: 'Otros', nombreNormalizado: 'otros' })
    await e.sembrar('productos', producto('lejia'))
    await e.sembrar('operaciones', operacion('op-1'))
    await e.sembrar('avisos', { productoId: 'lejia', ultimoEstadoAvisado: 'AGOTADO' })
    await sembrarProyecciones(e)
    expect(await e.almacen.leerTodo()).toEqual({
      configuracion: null,
      categorias: [{ id: 'cat-1', nombre: 'Otros', nombreNormalizado: 'otros' }],
      productos: [producto('lejia')],
      operaciones: [operacion('op-1')],
      avisos: [{ productoId: 'lejia', ultimoEstadoAvisado: 'AGOTADO' }],
      fotos: [],
    })
  })

  it('leerTodo trae las fotos como base64, con el tipo del Blob original', async () => {
    const e = crear()
    await e.sembrar('productos', producto('lejia'))
    await e.sembrar('fotos', {
      productoId: 'lejia',
      imagen: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
    })
    const datos = await e.almacen.leerTodo()
    expect(datos.fotos).toEqual([{ productoId: 'lejia', tipo: 'image/jpeg', base64: 'AQID' }])
  })

  it('reemplazarTodo reemplaza categorías, productos, operaciones, avisos y fotos', async () => {
    const e = crear()
    await e.sembrar('categorias', { id: 'vieja', nombre: 'Vieja', nombreNormalizado: 'vieja' })
    await e.sembrar('productos', producto('viejo'))
    await e.sembrar('operaciones', operacion('op-vieja'))
    await e.sembrar('avisos', { productoId: 'viejo', ultimoEstadoAvisado: 'AGOTADO' })
    await e.sembrar('fotos', { productoId: 'viejo', imagen: new Blob([new Uint8Array([1])]) })

    await e.almacen.reemplazarTodo({
      ...DATOS_VACIOS,
      productos: [producto('lejia')],
      categorias: [{ id: 'cat-1', nombre: 'Otros', nombreNormalizado: 'otros' }],
      operaciones: [operacion('op-1')],
      avisos: [{ productoId: 'lejia', ultimoEstadoAvisado: 'POR_ACABARSE' }],
      fotos: [{ productoId: 'lejia', tipo: 'image/png', base64: 'CQgH' }],
    })

    expect((await e.leer('productos')).map((p) => p.id)).toEqual(['lejia'])
    expect((await e.leer('categorias')).map((c) => c.id)).toEqual(['cat-1'])
    expect((await e.leer('operaciones')).map((o) => o.id)).toEqual(['op-1'])
    expect(await e.leer('avisos')).toEqual([
      { productoId: 'lejia', ultimoEstadoAvisado: 'POR_ACABARSE' },
    ])
    expect((await e.leer('fotos')).map((f) => f.productoId)).toEqual(['lejia'])
  })

  it('reemplazarTodo vacía existencias, resúmenes, lista de compras y conteo', async () => {
    const e = crear()
    await sembrarProyecciones(e)
    await e.almacen.reemplazarTodo(DATOS_VACIOS)
    expect(await e.leer('existencias')).toHaveLength(0)
    expect(await e.leer('resumenes')).toHaveLength(0)
    expect(await e.leer('listaDeCompras')).toHaveLength(0)
    expect(await e.leer('conteo')).toHaveLength(0)
  })

  it('reemplazarTodo NO toca el estado del sistema', async () => {
    const e = crear()
    await e.sembrar('configuracion', SISTEMA)
    await e.almacen.reemplazarTodo(DATOS_VACIOS)
    expect(await e.leer('configuracion')).toEqual([SISTEMA])
  })

  it('reemplazarTodo también reemplaza la configuración del negocio', async () => {
    const e = crear()
    await e.sembrar('configuracion', { ...NEGOCIO, nombreTienda: 'Vieja' }, SISTEMA)
    const nueva: ConfiguracionRegistro = {
      ...NEGOCIO,
      nombreTienda: 'Nueva',
      diasEntreCompras: 10,
      diasAnticipacion: 2,
      diasMaximosDeCompra: 60,
      tamanoDeLetra: 'NORMAL',
      notificacionesActivas: true,
    }
    await e.almacen.reemplazarTodo({ ...DATOS_VACIOS, configuracion: nueva })
    const configuracion = await e.leer('configuracion')
    expect(configuracion.find((r) => r.clave === 'negocio')).toEqual(nueva)
    expect(configuracion.find((r) => r.clave === 'sistema')).toEqual(SISTEMA)
  })

  it('reemplazarTodo con configuracion null conserva la configuración actual del negocio', async () => {
    const e = crear()
    await e.sembrar('configuracion', { ...NEGOCIO, nombreTienda: 'Vieja' })
    await e.almacen.reemplazarTodo(DATOS_VACIOS)
    expect(await e.leer('configuracion')).toEqual([{ ...NEGOCIO, nombreTienda: 'Vieja' }])
  })

  it('reemplazarTodo fuerza la clave "negocio" en la configuración (nunca pisa el sistema)', async () => {
    const e = crear()
    await e.sembrar('configuracion', SISTEMA)
    await e.almacen.reemplazarTodo({
      ...DATOS_VACIOS,
      configuracion: {
        ...NEGOCIO,
        clave: 'sistema',
        extra: 'campo ajeno',
        nombreTienda: 'Nueva',
      } as unknown as NonNullable<DatosDelRespaldo['configuracion']>,
    })
    const configuracion = await e.leer('configuracion')
    expect(configuracion.find((r) => r.clave === 'sistema')).toEqual(SISTEMA)
    const negocio = configuracion.find((r) => r.clave === 'negocio')
    expect(negocio).toEqual({ ...NEGOCIO, nombreTienda: 'Nueva' })
    expect(negocio).not.toHaveProperty('extra')
  })

  it('ida y vuelta: reemplazarTodo con lo que dio leerTodo conserva todo, fotos incluidas', async () => {
    const origen = crear()
    await origen.sembrar('configuracion', NEGOCIO)
    await origen.sembrar('categorias', { id: 'cat-1', nombre: 'Otros', nombreNormalizado: 'otros' })
    await origen.sembrar('productos', producto('lejia'))
    await origen.sembrar('operaciones', operacion('op-1'))
    await origen.sembrar('avisos', { productoId: 'lejia', ultimoEstadoAvisado: 'NORMAL' })
    await origen.sembrar('fotos', {
      productoId: 'lejia',
      imagen: new Blob([new Uint8Array([9, 8, 7])], { type: 'image/png' }),
    })
    const datos = await origen.almacen.leerTodo()

    const destino = crear()
    await destino.almacen.reemplazarTodo(datos)

    expect(await destino.almacen.leerTodo()).toEqual(datos)
    const [foto] = await destino.leer('fotos')
    expect(foto?.imagen.type).toBe('image/png')
    expect([...new Uint8Array(await foto!.imagen.arrayBuffer())]).toEqual([9, 8, 7])
  })
}
