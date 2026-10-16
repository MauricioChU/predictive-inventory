import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { ProductoVista } from '@/modules/catalogo'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { errorParaMostrar, type ErrorParaMostrar } from './mensajes-de-error'
import { usarFotos } from './usar-fotos'

/**
 * El producto de `/productos/:id/…` (Registrar pérdida, Contar stock), con su foto. `estado` dice
 * qué mostrar mientras tanto: cargando, el producto, o que no se puede usar (no existe o está
 * archivado, RN-OP-08). `recargar()` lo vuelve a leer (el stock cambió).
 */
export function usarProductoDeLaRuta() {
  const aplicacion = useAplicacion()
  const route = useRoute()
  const fotos = usarFotos()
  const producto = ref<ProductoVista | null>(null)
  const cargado = ref(false)
  const error = ref<ErrorParaMostrar | null>(null)

  const id = computed(() => String(route.params.id ?? ''))

  async function recargar(): Promise<void> {
    try {
      producto.value = await aplicacion.catalogo.obtenerProducto(id.value)
      error.value = null
      if (producto.value) void fotos.cargar([producto.value])
    } catch (causa) {
      error.value = errorParaMostrar(causa, 'merma')
    } finally {
      cargado.value = true
    }
  }

  watch(id, () => void recargar(), { immediate: true })

  return {
    producto,
    cargado,
    error,
    recargar,
    foto: computed(() => (producto.value ? fotos.foto(producto.value.id) : undefined)),
    /** RN-OP-08: solo se operan productos activos. */
    usable: computed(() => producto.value?.activo === true),
  }
}
