import { computed, onMounted, ref } from 'vue'
import type { ProductoVista } from '@/modules/catalogo'
import { useAplicacion } from '@/app/proveer-aplicacion'
import type { Dinero } from '@/shared/domain/dinero'
import { useAnunciador } from '@/shared/ui/anunciador'
import type { CarritoDePantalla } from './carrito-de-pantalla'
import { enfocarTitulo } from './foco-y-respuesta'

/** "Lejía 1 L", "Lejía 1 L y Carbón", "Lejía 1 L, Carbón y Escoba". */
function enumerar(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres.join('')
  return `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`
}

/**
 * r2 #1: el carrito guardado (M9) puede tener productos como estaban hace un rato. Al abrir la
 * pantalla con un carrito no vacío, cada línea se vuelve a leer con los casos de uso y se pone
 * al día (stock, precio de siempre, archivados fuera, ver `CarritoDePantalla.refrescar`); lo que
 * se quitó se dice con un aviso visible y anunciado. `preciosActuales()` es lo que se lee al
 * confirmar una venta, para cobrar exactamente lo que se ve.
 */
export function usarCarritoAlDia(carrito: CarritoDePantalla) {
  const aplicacion = useAplicacion()
  const anunciador = useAnunciador()
  const quitados = ref<string[]>([])

  async function productosActuales(): Promise<Map<string, ProductoVista | null>> {
    const ids = carrito.lineas.value.map((l) => l.producto.id)
    const productos = await Promise.all(ids.map((id) => aplicacion.catalogo.obtenerProducto(id)))
    return new Map(ids.map((id, i) => [id, productos[i] ?? null]))
  }

  const textoDeQuitados = computed(() =>
    quitados.value.length === 1
      ? `Quitamos ${quitados.value[0]}: ya no está a la venta`
      : `Quitamos ${enumerar(quitados.value)}: ya no están a la venta`,
  )

  /**
   * Plan 17: un fallo al leer se registra y el carrito queda como estaba (nunca un rechazo sin
   * manejar desde onMounted). Si el aviso de lo quitado sigue abierto, los nombres nuevos se
   * suman a los que ya decía: un segundo refresco no los pisa.
   */
  async function refrescar(): Promise<void> {
    if (carrito.vacio.value) return
    let nombres: string[]
    try {
      nombres = carrito.refrescar(await productosActuales())
    } catch (error) {
      console.error('No se pudo poner al día el carrito:', error)
      return
    }
    const nuevos = nombres.filter((n) => !quitados.value.includes(n))
    if (nuevos.length === 0) return
    quitados.value = [...quitados.value, ...nuevos]
    anunciador.anunciar(textoDeQuitados.value)
  }

  async function preciosActuales(): Promise<Map<string, Dinero>> {
    const precios = new Map<string, Dinero>()
    for (const [id, producto] of await productosActuales()) {
      if (producto) precios.set(id, producto.precioVenta)
    }
    return precios
  }

  onMounted(refrescar)

  return {
    quitados,
    textoDeQuitados,
    refrescar,
    preciosActuales,
    /** Plan 17 (RN-UX-15): el "Cerrar" desaparece con el aviso: el foco va al título. */
    cerrarAviso: async (): Promise<void> => {
      quitados.value = []
      await enfocarTitulo()
    },
  }
}
