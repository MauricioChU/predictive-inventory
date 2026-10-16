import { describe, expect, it } from 'vitest'
import { AlmacenEnMemoria } from '../../../../shared/infrastructure/memoria/almacen-en-memoria'
import type { DatosDelRespaldo } from '../../domain/formato-de-respaldo'
import { AlmacenDeRespaldoEnMemoria } from './almacen-de-respaldo'

const DATOS_VACIOS: DatosDelRespaldo = {
  configuracion: null,
  categorias: [],
  productos: [],
  operaciones: [],
  avisos: [],
  fotos: [],
}

function producto(id: string) {
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

describe('AlmacenDeRespaldoEnMemoria', () => {
  it('leerTodo devuelve todo vacío al principio', async () => {
    const almacen = new AlmacenDeRespaldoEnMemoria(new AlmacenEnMemoria())
    expect(await almacen.leerTodo()).toEqual(DATOS_VACIOS)
  })

  it('leerTodo incluye la configuración del negocio, pero no el estado del sistema', async () => {
    const memoria = new AlmacenEnMemoria()
    memoria.guardar('configuracion', {
      clave: 'negocio',
      nombreTienda: 'Bodega Rosita',
      diasEntreCompras: 7,
      diasAnticipacion: 3,
      diasMaximosDeCompra: 30,
      tamanoDeLetra: 'GRANDE',
      notificacionesActivas: false,
    })
    memoria.guardar('configuracion', {
      clave: 'sistema',
      dispositivoId: 'dispositivo-1',
      primeraVezCompletada: true,
      ultimoRespaldoEn: null,
      almacenamientoPersistente: 'CONCEDIDO',
      ultimoResumenDelDiaMostrado: null,
    })

    const almacen = new AlmacenDeRespaldoEnMemoria(memoria)
    const datos = await almacen.leerTodo()
    expect(datos.configuracion?.nombreTienda).toBe('Bodega Rosita')
  })

  it('leerTodo trae las fotos como base64, con el tipo del Blob original', async () => {
    const memoria = new AlmacenEnMemoria()
    memoria.guardar('productos', producto('lejia'))
    memoria.guardar('fotos', {
      productoId: 'lejia',
      imagen: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
    })

    const almacen = new AlmacenDeRespaldoEnMemoria(memoria)
    const datos = await almacen.leerTodo()
    expect(datos.fotos).toEqual([
      { productoId: 'lejia', tipo: 'image/jpeg', base64: expect.any(String) },
    ])
  })

  it('reemplazarTodo reemplaza categorías, productos, operaciones, avisos y fotos', async () => {
    const memoria = new AlmacenEnMemoria()
    const almacen = new AlmacenDeRespaldoEnMemoria(memoria)

    await almacen.reemplazarTodo({
      ...DATOS_VACIOS,
      productos: [producto('lejia')],
      categorias: [{ id: 'cat-1', nombre: 'Otros', nombreNormalizado: 'otros' }],
    })

    expect(memoria.todos('productos')).toHaveLength(1)
    expect(memoria.todos('categorias')).toHaveLength(1)
  })

  it('reemplazarTodo vacía existencias, resúmenes, lista de compras y conteo', async () => {
    const memoria = new AlmacenEnMemoria()
    memoria.guardar('existencias', { productoId: 'lejia', cantidad: 10000 })
    memoria.guardar('resumenes', {
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
    memoria.guardar('listaDeCompras', { dia: '2026-10-15', cambios: [] })
    memoria.guardar('conteo', {
      id: 'actual',
      iniciadoEn: '2026-10-15T00:00:00.000Z',
      orden: [],
      posicion: 0,
      contados: [],
      saltados: [],
      terminadoEn: null,
    })

    const almacen = new AlmacenDeRespaldoEnMemoria(memoria)
    await almacen.reemplazarTodo(DATOS_VACIOS)

    expect(memoria.todos('existencias')).toHaveLength(0)
    expect(memoria.todos('resumenes')).toHaveLength(0)
    expect(memoria.todos('listaDeCompras')).toHaveLength(0)
    expect(memoria.todos('conteo')).toHaveLength(0)
  })

  it('reemplazarTodo NO toca el estado del sistema', async () => {
    const memoria = new AlmacenEnMemoria()
    memoria.guardar('configuracion', {
      clave: 'sistema',
      dispositivoId: 'dispositivo-1',
      primeraVezCompletada: true,
      ultimoRespaldoEn: '2026-10-01T00:00:00.000Z',
      almacenamientoPersistente: 'CONCEDIDO',
      ultimoResumenDelDiaMostrado: null,
    })

    const almacen = new AlmacenDeRespaldoEnMemoria(memoria)
    await almacen.reemplazarTodo(DATOS_VACIOS)

    expect(memoria.obtener('configuracion', 'sistema')).toMatchObject({
      dispositivoId: 'dispositivo-1',
      primeraVezCompletada: true,
    })
  })

  it('reemplazarTodo también reemplaza la configuración del negocio', async () => {
    const memoria = new AlmacenEnMemoria()
    memoria.guardar('configuracion', {
      clave: 'negocio',
      nombreTienda: 'Vieja',
      diasEntreCompras: 7,
      diasAnticipacion: 3,
      diasMaximosDeCompra: 30,
      tamanoDeLetra: 'GRANDE',
      notificacionesActivas: false,
    })

    const almacen = new AlmacenDeRespaldoEnMemoria(memoria)
    await almacen.reemplazarTodo({
      ...DATOS_VACIOS,
      configuracion: {
        clave: 'negocio',
        nombreTienda: 'Nueva',
        diasEntreCompras: 10,
        diasAnticipacion: 2,
        diasMaximosDeCompra: 60,
        tamanoDeLetra: 'NORMAL',
        notificacionesActivas: true,
      },
    })

    const negocio = memoria.obtener('configuracion', 'negocio') as
      { nombreTienda: string } | undefined
    expect(negocio?.nombreTienda).toBe('Nueva')
  })

  it('reemplazarTodo con configuracion null conserva la configuración actual del negocio', async () => {
    const memoria = new AlmacenEnMemoria()
    memoria.guardar('configuracion', {
      clave: 'negocio',
      nombreTienda: 'Vieja',
      diasEntreCompras: 7,
      diasAnticipacion: 3,
      diasMaximosDeCompra: 30,
      tamanoDeLetra: 'GRANDE',
      notificacionesActivas: false,
    })

    const almacen = new AlmacenDeRespaldoEnMemoria(memoria)
    await almacen.reemplazarTodo(DATOS_VACIOS)

    expect(memoria.obtener('configuracion', 'negocio')).toMatchObject({ nombreTienda: 'Vieja' })
  })

  it('ida y vuelta: reemplazarTodo con fotos de leerTodo conserva el contenido', async () => {
    const memoria = new AlmacenEnMemoria()
    memoria.guardar('productos', producto('lejia'))
    memoria.guardar('fotos', {
      productoId: 'lejia',
      imagen: new Blob([new Uint8Array([9, 8, 7])], { type: 'image/png' }),
    })
    const almacen = new AlmacenDeRespaldoEnMemoria(memoria)
    const datos = await almacen.leerTodo()

    const otraMemoria = new AlmacenEnMemoria()
    const otroAlmacen = new AlmacenDeRespaldoEnMemoria(otraMemoria)
    await otroAlmacen.reemplazarTodo(datos)

    const foto = otraMemoria.obtener('fotos', 'lejia')
    expect(foto?.imagen.type).toBe('image/png')
    const bytes = new Uint8Array(await foto!.imagen.arrayBuffer())
    expect([...bytes]).toEqual([9, 8, 7])
  })

  it('reemplazarTodo fuerza la clave "negocio" en la configuración (nunca pisa el sistema)', async () => {
    const memoria = new AlmacenEnMemoria()
    memoria.guardar('configuracion', {
      clave: 'sistema',
      dispositivoId: 'dispositivo-1',
      primeraVezCompletada: true,
      ultimoRespaldoEn: null,
      almacenamientoPersistente: 'CONCEDIDO',
      ultimoResumenDelDiaMostrado: null,
    })
    const almacen = new AlmacenDeRespaldoEnMemoria(memoria)
    await almacen.reemplazarTodo({
      ...DATOS_VACIOS,
      configuracion: {
        clave: 'sistema',
        extra: 'campo ajeno',
        nombreTienda: 'Nueva',
        diasEntreCompras: 7,
        diasAnticipacion: 3,
        diasMaximosDeCompra: 30,
        tamanoDeLetra: 'GRANDE',
        notificacionesActivas: false,
      } as unknown as NonNullable<DatosDelRespaldo['configuracion']>,
    })
    expect(memoria.obtener('configuracion', 'sistema')).toMatchObject({
      dispositivoId: 'dispositivo-1',
    })
    expect(memoria.obtener('configuracion', 'negocio')).toMatchObject({ nombreTienda: 'Nueva' })
    expect(memoria.obtener('configuracion', 'negocio')).not.toHaveProperty('extra')
  })
})
