import { instanteLocal } from '@/shared/domain/fecha'
import {
  crearAplicacionDePrueba,
  type AplicacionDePrueba,
} from '../../../../../tests/soporte/aplicacion-de-prueba'
import {
  crearProductoDePrueba,
  type ProductoDePrueba,
} from '../../../../../tests/soporte/productos-de-prueba'

/** "Hoy" de torre-de-control.feature: jueves 2026-10-15 a las 18:00 en Lima. */
export const HOY = '2026-10-15 18:00'

/**
 * Una tienda de verdad (la composición de pruebas, en memoria) a la que se le arma historia
 * SOLO con los casos de uso: para fechar una operación se mueve el reloj a ese momento y se
 * vuelve a "hoy" (como los pasos Gherkin, M15). Los productos se nombran por su nombre.
 */
export class TiendaDePrueba {
  readonly app: AplicacionDePrueba
  private readonly ids = new Map<string, string>()

  constructor(hoy = HOY) {
    this.app = crearAplicacionDePrueba({ ahora: instanteLocal(hoy) })
  }

  id(nombre: string): string {
    const id = this.ids.get(nombre)
    if (!id) throw new Error(`No se creó "${nombre}"`)
    return id
  }

  /** Crea el producto (con su stock inicial) el día `desde` ("AAAA-MM-DD HH:mm"), o hoy. */
  async producto(producto: ProductoDePrueba, desde?: string): Promise<string> {
    const id = await this.en(desde, () => crearProductoDePrueba(this.app, producto))
    this.ids.set(producto.nombre, id)
    return id
  }

  async vender(nombre: string, cantidad: string, cuando?: string): Promise<void> {
    await this.en(cuando, () =>
      this.app.inventario.registrarVenta({ lineas: [{ productoId: this.id(nombre), cantidad }] }),
    )
  }

  async merma(nombre: string, cantidad: string, cuando?: string): Promise<void> {
    await this.en(cuando, () =>
      this.app.inventario.registrarMerma({
        productoId: this.id(nombre),
        cantidad,
        motivo: 'Se derramó',
      }),
    )
  }

  async contar(nombre: string, contado: string, cuando?: string): Promise<void> {
    await this.en(cuando, () =>
      this.app.inventario.contarStock({ productoId: this.id(nombre), contado }),
    )
  }

  async recibir(nombre: string, cantidad: string, costo: string, cuando?: string): Promise<void> {
    await this.en(cuando, async () => {
      const respuesta = await this.app.inventario.registrarIngreso({
        lineas: [{ productoId: this.id(nombre), cantidad, costo }],
        confirmarSobrecompra: true,
        actualizarPreciosDeCompra: false,
      })
      if (respuesta.tipo !== 'hecho') throw new Error(`No se registró la llegada de "${nombre}"`)
    })
  }

  private async en<T>(cuando: string | undefined, accion: () => Promise<T>): Promise<T> {
    if (cuando === undefined) return accion()
    // Se vuelve al "hoy" por donde iba (no al de la creación): dos operaciones de hoy nunca
    // comparten instante de registro.
    const vuelta = this.app.reloj.ahora()
    this.app.reloj.fijar(instanteLocal(cuando))
    try {
      return await accion()
    } finally {
      this.app.reloj.fijar(vuelta)
    }
  }
}
