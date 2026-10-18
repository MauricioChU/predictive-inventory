import type { AlmacenEnMemoria } from '../../../../shared/infrastructure/memoria/almacen-en-memoria'
import type { ConfiguracionRegistro } from '../../../../shared/contratos/registros'
import type { UnidadDeTrabajo } from '../../../../shared/application/unidad-de-trabajo'
import type { DatosDelRespaldo } from '../../domain/formato-de-respaldo'
import type { AlmacenDeRespaldo } from '../../application/puertos'
import { base64ABlob, blobABase64 } from '../navegador/imagenes'

/**
 * Lee y reemplaza todo lo que guarda un respaldo, sobre el mismo AlmacenEnMemoria que usan
 * las demás pruebas de Respaldo. No toca 'sistema' en la tabla 'configuracion' (el estado
 * del sistema vive en el módulo Tienda, en la misma tabla pero con otra clave).
 *
 * `uow`: en una composición, la misma unidad de trabajo de los módulos. Con ella, `leerTodo`
 * lee dentro de una transacción (espera a las que están en curso y no ve lo que dejan a
 * medias), como la transacción de lectura del almacén de Dexie. Sin ella, lee en el acto.
 */
export class AlmacenDeRespaldoEnMemoria implements AlmacenDeRespaldo {
  constructor(
    private readonly almacen: AlmacenEnMemoria,
    private readonly uow?: UnidadDeTrabajo,
  ) {}

  /** Una foto coherente: lee todas las tablas de una vez y recién después convierte las fotos. */
  async leerTodo(): Promise<DatosDelRespaldo> {
    const leer = async () => ({
      registros: {
        configuracion:
          (this.almacen.obtener('configuracion', 'negocio') as ConfiguracionRegistro | undefined) ??
          null,
        categorias: this.almacen.todos('categorias'),
        productos: this.almacen.todos('productos'),
        operaciones: this.almacen.todos('operaciones'),
        avisos: this.almacen.todos('avisos'),
      },
      fotosGuardadas: this.almacen.todos('fotos'),
    })
    const { registros, fotosGuardadas } = await (this.uow ? this.uow.ejecutar(leer) : leer())

    const fotos = await Promise.all(
      fotosGuardadas.map(async (foto) => ({
        productoId: foto.productoId,
        tipo: foto.imagen.type,
        base64: await blobABase64(foto.imagen),
      })),
    )
    return { ...registros, fotos }
  }

  async reemplazarTodo(datos: DatosDelRespaldo): Promise<void> {
    this.almacen.vaciar('categorias')
    this.almacen.vaciar('productos')
    this.almacen.vaciar('operaciones')
    this.almacen.vaciar('avisos')
    this.almacen.vaciar('fotos')
    this.almacen.vaciar('existencias')
    this.almacen.vaciar('resumenes')
    this.almacen.vaciar('listaDeCompras')
    this.almacen.vaciar('conteo')

    // Sin configuración en la copia se conserva la actual; con ella, siempre bajo la clave 'negocio'.
    if (datos.configuracion) {
      const c = datos.configuracion
      this.almacen.guardar('configuracion', {
        clave: 'negocio',
        nombreTienda: c.nombreTienda,
        diasEntreCompras: c.diasEntreCompras,
        diasAnticipacion: c.diasAnticipacion,
        diasMaximosDeCompra: c.diasMaximosDeCompra,
        tamanoDeLetra: c.tamanoDeLetra,
        notificacionesActivas: c.notificacionesActivas,
        alquilerDelLocal: c.alquilerDelLocal ?? null,
      })
    }
    for (const categoria of datos.categorias) this.almacen.guardar('categorias', categoria)
    for (const producto of datos.productos) this.almacen.guardar('productos', producto)
    for (const operacion of datos.operaciones) this.almacen.guardar('operaciones', operacion)
    for (const aviso of datos.avisos) this.almacen.guardar('avisos', aviso)
    for (const foto of datos.fotos) {
      this.almacen.guardar('fotos', {
        productoId: foto.productoId,
        imagen: await base64ABlob(foto.base64, foto.tipo),
      })
    }
  }
}
