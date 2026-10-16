import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FiltroDeEstado } from './presentacion'

/**
 * Lo último que se buscó y filtró en Productos durante esta sesión: al volver del detalle de un
 * producto la lista sigue igual (no hay que volver a escribir la búsqueda). Vive en memoria
 * (Pinia): al cerrar la app se olvida.
 */
export const useFiltrosDeProductos = defineStore('filtros-de-productos', () => {
  const texto = ref('')
  const estado = ref<FiltroDeEstado>('TODOS')
  /** '' = todas las categorías. */
  const categoriaId = ref('')
  return { texto, estado, categoriaId }
})
