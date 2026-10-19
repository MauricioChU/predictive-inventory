import { expect } from 'vitest'
import { filtrarProductos, type DatosDeEdicion } from '@/modules/catalogo'
import type { DatosDeProductoNuevo } from '@/shared/contratos/entre-modulos'
import type { Unidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { formatearNumero } from '@/shared/domain/formato'
import type { ArgumentoExtra } from '../../gherkin/registro-de-pasos'
import { fotoDeCamara, medidasDeFoto } from '../../soporte/fotos-simuladas'
import type { Mundo } from './mundo'
import { accion, afirmacion, celda, filasDe, lista, preparacion, type Pasos } from './registro'

/** RN-CAT-14: la foto guardada mide a lo sumo 512 px en su lado mayor y pesa a lo sumo 100 KB. */
const LADO_MAYOR_MAXIMO = 512
const BYTES_MAXIMOS = 100 * 1024

/** Lo que el formulario trae por defecto cuando el escenario no lo dice. */
async function productoPorDefecto(m: Mundo): Promise<DatosDeProductoNuevo> {
  return {
    nombre: m.nombreSinNombre(),
    categoriaId: await m.categoriaPorDefecto(),
    unidad: 'UNIDAD',
    precioCompra: '2.40',
    precioVenta: '3.50',
    stockMinimo: '3',
  }
}

/** "Guardar" en el formulario de producto nuevo (sin confirmar: RN-CAT-05 pregunta). */
async function crear(m: Mundo, datos: DatosDeProductoNuevo): Promise<void> {
  m.cantidadAntes = (await m.app.catalogo.consultable.productos()).length
  await m.atender(
    (confirmado) => m.app.catalogo.crearProducto({ ...datos, confirmado }),
    'creado',
    ({ productoId }) => {
      m.recordar(datos.nombre, productoId)
      m.ultimoProductoCreado = productoId
    },
  )
}

async function editar(m: Mundo, datos: DatosDeEdicion): Promise<void> {
  await m.atender(
    (confirmado) => m.app.catalogo.editarProducto({ ...datos, confirmado }),
    'editado',
  )
}

/** Una operación del historial del producto con ese tipo y esa cantidad (con signo). */
export async function operacionDe(m: Mundo, tipo: string, cantidad: string, nombre: string) {
  const productoId = await m.idDe(nombre)
  const operaciones = await m.app.inventario.historial({ productoId })
  const encontradas = operaciones.flatMap((operacion) =>
    operacion.tipo === tipo
      ? operacion.lineas
          .filter((l) => l.productoId === productoId && formatearNumero(l.cantidad) === cantidad)
          .map((linea) => ({ operacion, linea }))
      : [],
  )
  expect(
    encontradas,
    `${nombre} tiene: ${operaciones.map((o) => `${o.tipo} ${o.lineas.map((l) => formatearNumero(l.cantidad)).join('/')}`).join(', ')}`,
  ).not.toHaveLength(0)
  return encontradas
}

/** Pasos de Catálogo (01-catalogo, RN-CAT). */
export function pasosDeCatalogo(pasos: Pasos): void {
  // Solo las del escenario (sin las diez iniciales); la primera es la del formulario.
  preparacion(pasos, 'existen las categorías {string}', async (m: Mundo, nombres: string) => {
    m.categorias = lista(nombres)
    for (const nombre of m.categorias) await m.categoriaId(nombre)
  })

  // Productos ya cargados: por el caso de uso real (con su STOCK_INICIAL, RN-CAT-08). Uno que
  // la tabla trae archivado YA estaba archivado: se crea y se archiva con los eventos en
  // silencio (su vida activa es historia anterior al escenario y no avisó en él, RN-AL-01).
  preparacion(pasos, 'los productos:', async (m: Mundo, extra: ArgumentoExtra) => {
    for (const fila of filasDe(extra)) {
      const nombre = celda(fila, 'nombre')
      const stock = fila.stock ?? ''
      const datos = {
        nombre,
        categoriaId: await m.categoriaId(celda(fila, 'categoría')),
        unidad: celda(fila, 'unidad') as Unidad,
        precioCompra: celda(fila, 'compra'),
        precioVenta: celda(fila, 'venta'),
        stockMinimo: celda(fila, 'mínimo'),
        ...(stock === '' ? {} : { stockInicial: stock }),
        confirmado: true,
      }
      const crear = async () => {
        const respuesta = await m.app.catalogo.crearProducto(datos)
        if (respuesta.tipo !== 'hecho') throw new Error(`No se creó "${nombre}": ${respuesta.tipo}`)
        return respuesta.valor.productoId
      }
      if (fila.archivado !== 'sí') {
        m.recordar(nombre, await crear())
        continue
      }
      await m.app.sinEventos(async () => {
        const productoId = await crear()
        m.recordar(nombre, productoId)
        const archivado = await m.app.catalogo.archivarProducto({ productoId, confirmado: true })
        if (archivado.tipo !== 'hecho') throw new Error(`No se archivó "${nombre}"`)
      })
    }
  })

  accion(pasos, 'creo un producto con nombre {string}', async (m: Mundo, nombre: string) => {
    await crear(m, { ...(await productoPorDefecto(m)), nombre })
  })

  accion(
    pasos,
    'creo un producto con precio de compra {string} y precio de venta {string}',
    async (m: Mundo, compra: string, venta: string) => {
      await crear(m, { ...(await productoPorDefecto(m)), precioCompra: compra, precioVenta: venta })
    },
  )

  accion(
    pasos,
    'creo un producto con unidad {string} y stock mínimo {string}',
    async (m: Mundo, unidad: string, minimo: string) => {
      await crear(m, {
        ...(await productoPorDefecto(m)),
        unidad: unidad as Unidad,
        stockMinimo: minimo,
      })
    },
  )

  accion(
    pasos,
    'creo el producto {string} con unidad {string}, precio de compra {string}, precio de venta {string}, stock mínimo {string} y stock inicial {string}',
    async (
      m: Mundo,
      nombre: string,
      unidad: string,
      compra: string,
      venta: string,
      minimo: string,
      inicial: string,
    ) => {
      await crear(m, {
        ...(await productoPorDefecto(m)),
        nombre,
        unidad: unidad as Unidad,
        precioCompra: compra,
        precioVenta: venta,
        stockMinimo: minimo,
        stockInicial: inicial,
      })
    },
  )

  accion(
    pasos,
    'cambio la unidad de {string} a {string}',
    async (m: Mundo, nombre: string, unidad: string) => {
      await editar(m, { productoId: await m.idDe(nombre), unidad: unidad as Unidad })
    },
  )

  accion(
    pasos,
    'cambio el precio de venta de {string} a {string} y el de compra a {string}',
    async (m: Mundo, nombre: string, venta: string, compra: string) => {
      await editar(m, {
        productoId: await m.idDe(nombre),
        precioVenta: venta,
        precioCompra: compra,
      })
    },
  )

  accion(
    pasos,
    'cambio el stock mínimo de {string} a {string}',
    async (m: Mundo, nombre: string, minimo: string) => {
      await editar(m, { productoId: await m.idDe(nombre), stockMinimo: minimo })
    },
  )

  accion(pasos, 'archivo {string}', async (m: Mundo, nombre: string) => {
    const productoId = await m.idDe(nombre)
    await m.atender(
      (confirmado) => m.app.catalogo.archivarProducto({ productoId, confirmado }),
      'archivado',
    )
  })

  accion(pasos, 'busco {string}', async (m: Mundo, texto: string) => {
    m.busqueda = (await m.app.catalogo.buscarProductos({ texto })).map((p) => p.nombre)
  })

  // RN-CAT-14 (M8): el escenario no nombra el producto: es uno nuevo, creado con el formulario.
  // La foto de la cámara pasa por el procesador real (ProcesadorDeFotosCanvas) con
  // createImageBitmap y el lienzo simulados (tests/soporte/fotos-simuladas.ts).
  accion(
    pasos,
    'agrego al producto una foto de {int} x {int} px',
    async (m: Mundo, ancho: number, alto: number) => {
      await crear(m, await productoPorDefecto(m))
      if (!m.ultimoProductoCreado) throw new Error('No se creó el producto de la foto')
      await m.app.catalogo.guardarFoto(m.ultimoProductoCreado, fotoDeCamara(ancho, alto))
      m.resultado = 'foto guardada'
    },
  )

  accion(pasos, 'elimino la categoría {string}', async (m: Mundo, nombre: string) => {
    const categoriaId = await m.app.catalogo.importacion.categoriaPorNombre(nombre)
    if (!categoriaId) throw new Error(`No existe la categoría "${nombre}"`)
    await m.app.catalogo.eliminarCategoria(categoriaId)
    m.resultado = 'eliminada'
  })

  accion(pasos, 'creo la categoría {string}', async (m: Mundo, nombre: string) => {
    await m.app.catalogo.crearCategoria(nombre)
    m.resultado = 'creada'
  })

  afirmacion(
    pasos,
    'el producto {string} tiene unidad {string}',
    async (m: Mundo, nombre: string, unidad: string) => {
      expect((await m.producto(nombre)).unidad).toBe(unidad)
    },
  )

  afirmacion(
    pasos,
    'el producto {string} tiene precio de compra {string}',
    async (m: Mundo, nombre: string, precio: string) => {
      expect((await m.producto(nombre)).precioCompra.centimos).toBe(Dinero.deTexto(precio).centimos)
    },
  )

  afirmacion(
    pasos,
    'el producto {string} tiene precio de venta {string}',
    async (m: Mundo, nombre: string, precio: string) => {
      expect((await m.producto(nombre)).precioVenta.centimos).toBe(Dinero.deTexto(precio).centimos)
    },
  )

  afirmacion(pasos, 'el producto {string} está archivado', async (m: Mundo, nombre: string) => {
    expect((await m.producto(nombre)).activo).toBe(false)
  })

  afirmacion(
    pasos,
    'no se crea un producto nuevo',
    async (m: Mundo) => {
      expect(m.resultado).not.toBe('creado')
      expect(await m.app.catalogo.consultable.productos()).toHaveLength(m.cantidadAntes)
    },
    { revisa: true },
  )

  afirmacion(
    pasos,
    'se ofrece reactivar el producto {string}',
    (m: Mundo, nombre: string) => {
      expect(m.reactivar?.nombre).toBe(nombre)
    },
    { revisa: true },
  )

  // RN-CAT-16: el filtro de estado de la lista de Productos, con los estados de Análisis.
  accion(pasos, 'filtro los productos por {string}', async (m: Mundo, filtro: string) => {
    expect(filtro).toBe('Se acaban')
    const situaciones = await m.app.analisis.consultable.situaciones()
    m.busqueda = filtrarProductos(await m.app.catalogo.buscarProductos({ texto: '' }), {
      estado: 'SE_ACABAN',
      categoriaId: '',
      estados: new Map(situaciones.map((s) => [s.productoId, s.estado])),
    }).map((p) => p.nombre)
  })

  afirmacion(pasos, 'los resultados son {string}', (m: Mundo, resultados: string) => {
    expect(m.busqueda).toEqual(lista(resultados))
  })

  // Vender busca con el mismo caso de uso (RN-CAT-10: solo productos activos).
  afirmacion(
    pasos,
    'al buscar {string} para vender no aparece ningún producto',
    async (m: Mundo, texto: string) => {
      expect(await m.app.catalogo.buscarProductos({ texto })).toEqual([])
    },
  )

  afirmacion(
    pasos,
    'la foto guardada mide como máximo 512 px en su lado mayor',
    async (m: Mundo) => {
      const foto = await fotoGuardada(m)
      const { ancho, alto } = await medidasDeFoto(foto)
      expect(Math.max(ancho, alto)).toBeLessThanOrEqual(LADO_MAYOR_MAXIMO)
      // Se reduce, no se recorta: conserva la proporción (4000 × 3000 → 512 × 384).
      expect({ ancho, alto }).toEqual({ ancho: 512, alto: 384 })
    },
  )

  afirmacion(pasos, 'la foto guardada pesa como máximo 100 KB', async (m: Mundo) => {
    expect((await fotoGuardada(m)).size).toBeLessThanOrEqual(BYTES_MAXIMOS)
  })

  afirmacion(pasos, '{string} no tiene operaciones', async (m: Mundo, nombre: string) => {
    expect(await m.app.inventario.historial({ productoId: await m.idDe(nombre) })).toEqual([])
  })

  afirmacion(
    pasos,
    'existe una operación {string} de {string} para {string} con costo {string}',
    async (m: Mundo, tipo: string, cantidad: string, nombre: string, costo: string) => {
      const encontradas = await operacionDe(m, tipo, cantidad, nombre)
      const conCosto = encontradas.filter(({ linea }) =>
        linea.costoUnitario.igualA(Dinero.deTexto(costo)),
      )
      expect(conCosto).not.toHaveLength(0)
    },
  )

  afirmacion(
    pasos,
    'existe una operación {string} de {string} para {string} con motivo {string}',
    async (m: Mundo, tipo: string, cantidad: string, nombre: string, motivo: string) => {
      const encontradas = await operacionDe(m, tipo, cantidad, nombre)
      expect(encontradas.map(({ operacion }) => operacion.motivo)).toContain(motivo)
    },
  )
}

async function fotoGuardada(m: Mundo): Promise<Blob> {
  if (!m.ultimoProductoCreado) throw new Error('El escenario no agregó ninguna foto')
  const producto = await m.app.catalogo.obtenerProducto(m.ultimoProductoCreado)
  expect(producto?.tieneFoto).toBe(true)
  const foto = await m.app.catalogo.obtenerFoto(m.ultimoProductoCreado)
  if (!foto) throw new Error('El producto no tiene foto guardada')
  return foto
}
