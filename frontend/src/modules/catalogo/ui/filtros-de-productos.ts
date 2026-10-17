import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Router } from 'vue-router'
import type { FiltroDeEstado } from './presentacion'

/**
 * Lo último que se buscó y filtró en Productos durante esta sesión: al volver ATRÁS del detalle
 * de un producto, la lista sigue igual (no hay que volver a escribir la búsqueda). Vive en
 * memoria (Pinia): al cerrar la app se olvida.
 */
export const useFiltrosDeProductos = defineStore('filtros-de-productos', () => {
  const texto = ref('')
  const estado = ref<FiltroDeEstado>('TODOS')
  /** '' = todas las categorías. */
  const categoriaId = ref('')

  function olvidar(): void {
    texto.value = ''
    estado.value = 'TODOS'
    categoriaId.value = ''
  }

  return { texto, estado, categoriaId, olvidar }
})

/**
 * ¿Se llegó a la lista volviendo atrás desde el detalle (o la edición) de un producto? Entonces
 * se conservan los filtros. Si se entró desde la navegación (una entrada nueva del historial) o
 * se vuelve de crear un producto, no: un filtro viejo podría esconder lo recién agregado.
 */
export function vuelveAtrasDelDetalle(router: Pick<Router, 'options' | 'resolve'>): boolean {
  const adelante = router.options.history.state.forward
  if (typeof adelante !== 'string') return false
  const nombre = router.resolve(adelante).name
  return nombre === 'producto' || nombre === 'producto-editar'
}
