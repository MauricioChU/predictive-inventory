import { reactive } from 'vue'
import { useAplicacion } from '@/app/proveer-aplicacion'

/**
 * Las fotos de los productos (Blob guardado en el celular), leídas una sola vez por pantalla y
 * solo de los productos que tienen foto. Mientras no llegó (o si no tiene), FotoDeProducto
 * muestra el ícono de su categoría.
 */
export function usarFotos() {
  const aplicacion = useAplicacion()
  const fotos = reactive(new Map<string, Blob>())
  const pedidas = new Set<string>()

  async function cargar(productos: readonly { id: string; tieneFoto: boolean }[]): Promise<void> {
    const nuevas = productos.filter((p) => p.tieneFoto && !pedidas.has(p.id))
    for (const { id } of nuevas) pedidas.add(id)
    await Promise.all(
      nuevas.map(async ({ id }) => {
        try {
          const foto = await aplicacion.catalogo.obtenerFoto(id)
          if (foto) fotos.set(id, foto)
        } catch (error) {
          // Sin la foto se ve el ícono de la categoría: no es motivo para frenar la pantalla.
          console.error('No se pudo leer la foto del producto:', error)
        }
      }),
    )
  }

  return { foto: (id: string): Blob | undefined => fotos.get(id), cargar }
}
