import type { ConfiguracionRegistro, NombreDeTabla } from '../../../../shared/contratos/registros'
import type { BaseDeDatos } from '../../../../shared/infrastructure/dexie/base-de-datos'
import {
  enTransaccion,
  transaccionEnCurso,
} from '../../../../shared/infrastructure/dexie/unidad-de-trabajo-dexie'
import type { AlmacenDeRespaldo } from '../../application/puertos'
import type { DatosDelRespaldo } from '../../domain/formato-de-respaldo'
import { base64ABlob, blobABase64 } from '../navegador/imagenes'

/** Lo que guarda un respaldo (la tabla `configuracion` solo por su fila 'negocio'). */
const TABLAS_DEL_RESPALDO = [
  'configuracion',
  'categorias',
  'productos',
  'operaciones',
  'avisos',
  'fotos',
] as const satisfies readonly NombreDeTabla[]

/** Lo que `reemplazarTodo` vacía: lo que viene en la copia y las proyecciones (se reconstruyen). */
const TABLAS_QUE_SE_VACIAN = [
  'categorias',
  'productos',
  'operaciones',
  'avisos',
  'fotos',
  'existencias',
  'resumenes',
  'listaDeCompras',
  'conteo',
] as const satisfies readonly NombreDeTabla[]

/** Siempre bajo la clave 'negocio' y solo con los campos de la configuración (nunca pisa 'sistema'). */
function registroDeNegocio(c: ConfiguracionRegistro): ConfiguracionRegistro {
  return {
    clave: 'negocio',
    nombreTienda: c.nombreTienda,
    diasEntreCompras: c.diasEntreCompras,
    diasAnticipacion: c.diasAnticipacion,
    diasMaximosDeCompra: c.diasMaximosDeCompra,
    tamanoDeLetra: c.tamanoDeLetra,
    notificacionesActivas: c.notificacionesActivas,
    alquilerDelLocal: c.alquilerDelLocal ?? null,
  }
}

/**
 * `AlmacenDeRespaldo` sobre IndexedDB. No toca la fila 'sistema' de `configuracion` (el
 * estado del sistema vive en el módulo Tienda).
 *
 * `leerTodo` lee todos los registros en UNA transacción de lectura (una foto coherente) y
 * convierte las fotos a base64 DESPUÉS de cerrarla: `blob.arrayBuffer()` no es una petición
 * de IndexedDB, y esperarlo dentro dejaría la transacción sin peticiones, así que el navegador
 * la confirmaría antes de tiempo. Por eso no se llama dentro de una unidad de trabajo.
 */
export class AlmacenDeRespaldoDexie implements AlmacenDeRespaldo {
  constructor(private readonly db: BaseDeDatos) {}

  async leerTodo(): Promise<DatosDelRespaldo> {
    if (transaccionEnCurso(this.db)) {
      throw new Error(
        'leerTodo abre su propia transacción de lectura: no se llama dentro de una unidad de trabajo',
      )
    }
    const db = this.db
    // 'r!': siempre una transacción nueva (como 'rw!' en enTransaccion), aunque el código corra
    // en la zona de una transacción que ya terminó.
    const leido = await db.transaction('r!', [...TABLAS_DEL_RESPALDO], async () => {
      const [negocio, categorias, productos, operaciones, avisos, fotos] = await Promise.all([
        db.configuracion.get('negocio'),
        db.categorias.toArray(),
        db.productos.toArray(),
        db.operaciones.orderBy('registradaEn').toArray(),
        db.avisos.toArray(),
        db.fotos.toArray(),
      ])
      return {
        registros: {
          configuracion: (negocio as ConfiguracionRegistro | undefined) ?? null,
          categorias,
          productos,
          operaciones,
          avisos,
        },
        fotos,
      }
    })

    // La transacción ya cerró: ahora sí se pueden leer los Blob.
    const fotos = await Promise.all(
      leido.fotos.map(async (foto) => ({
        productoId: foto.productoId,
        tipo: foto.imagen.type,
        base64: await blobABase64(foto.imagen),
      })),
    )
    return { ...leido.registros, fotos }
  }

  /**
   * Limpia y escribe en una sola transacción (o en la de la unidad de trabajo en curso, como
   * en `restaurarCopia`): si algo falla, no cambia nada. Sin configuración en la copia, se
   * conserva la actual.
   */
  async reemplazarTodo(datos: DatosDelRespaldo): Promise<void> {
    // base64ABlob no hace E/S (atob + new Blob): esperarlo dentro de una transacción en curso
    // no la deja sin peticiones. Igual se decodifica antes de empezar a escribir.
    const fotos = await Promise.all(
      datos.fotos.map(async (foto) => ({
        productoId: foto.productoId,
        imagen: await base64ABlob(foto.base64, foto.tipo),
      })),
    )
    const db = this.db
    const tablas = [...TABLAS_QUE_SE_VACIAN, 'configuracion' as const].map((t) => db.table(t))
    await enTransaccion(db, tablas, async () => {
      for (const tabla of TABLAS_QUE_SE_VACIAN) await db.table(tabla).clear()
      if (datos.configuracion) await db.configuracion.put(registroDeNegocio(datos.configuracion))
      await db.categorias.bulkPut(datos.categorias)
      await db.productos.bulkPut(datos.productos)
      await db.operaciones.bulkPut(datos.operaciones)
      await db.avisos.bulkPut(datos.avisos)
      await db.fotos.bulkPut(fotos)
    })
  }
}
