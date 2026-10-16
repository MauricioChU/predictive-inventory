import type { AlmacenEnMemoria } from '../../../../shared/infrastructure/memoria/almacen-en-memoria'
import type { ConfiguracionRegistro } from '../../../../shared/contratos/registros'
import type { DatosDelRespaldo } from '../../domain/formato-de-respaldo'
import type { AlmacenDeRespaldo } from '../../application/puertos'
import { base64ABlob, blobABase64 } from '../navegador/imagenes'

/**
 * Lee y reemplaza todo lo que guarda un respaldo, sobre el mismo AlmacenEnMemoria que usan
 * las demás pruebas de Respaldo. No toca 'sistema' en la tabla 'configuracion' (el estado
 * del sistema vive en el módulo Tienda, en la misma tabla pero con otra clave).
 */
export class AlmacenDeRespaldoEnMemoria implements AlmacenDeRespaldo {
  constructor(private readonly almacen: AlmacenEnMemoria) {}

  async leerTodo(): Promise<DatosDelRespaldo> {
    const configuracion = this.almacen.obtener('configuracion', 'negocio') as
      ConfiguracionRegistro | undefined
    const fotos = await Promise.all(
      this.almacen.todos('fotos').map(async (foto) => ({
        productoId: foto.productoId,
        tipo: foto.imagen.type,
        base64: await blobABase64(foto.imagen),
      })),
    )

    return {
      configuracion: configuracion ?? null,
      categorias: this.almacen.todos('categorias'),
      productos: this.almacen.todos('productos'),
      operaciones: this.almacen.todos('operaciones'),
      avisos: this.almacen.todos('avisos'),
      fotos,
    }
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

    if (datos.configuracion) {
      this.almacen.guardar('configuracion', datos.configuracion)
    } else {
      this.almacen.eliminar('configuracion', 'negocio')
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
