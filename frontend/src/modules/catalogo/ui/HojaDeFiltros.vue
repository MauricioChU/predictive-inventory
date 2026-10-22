<script setup lang="ts">
import { computed } from 'vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import BotonesDeOpcion from '@/shared/ui/componentes/BotonesDeOpcion.vue'
import HojaInferior from '@/shared/ui/componentes/HojaInferior.vue'
import SelectorSegmentado from '@/shared/ui/componentes/SelectorSegmentado.vue'
import type { CategoriaVista } from '../application/modulo'
import { type FiltroDeEstado, OPCIONES_DE_ESTADO, textoDeConteo } from './presentacion'

/**
 * Los filtros de Productos en una hoja inferior: "Mostrar" (chips) y "Categoría" (una opción por
 * fila, la elegida marcada). Se aplican al tocar; el botón de abajo solo cierra y dice cuántos
 * productos quedan.
 */
const props = defineProps<{
  estado: FiltroDeEstado
  categoriaId: string
  categorias: readonly CategoriaVista[]
  /** Cuántos productos se ven con los filtros de ahora. */
  cantidad: number
  volverA?: HTMLElement | null
}>()
const emit = defineEmits<{
  'update:estado': [estado: FiltroDeEstado]
  'update:categoriaId': [categoriaId: string]
  cerrar: []
}>()

const opcionesDeCategoria = computed(() => [
  { valor: '', etiqueta: 'Todas las categorías' },
  ...props.categorias.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
])
const textoDelBoton = computed(() =>
  props.cantidad === 0 ? 'Ver productos' : `Ver ${textoDeConteo(props.cantidad)}`,
)
</script>

<template>
  <HojaInferior titulo="Filtros" :volver-a="volverA" @cerrar="emit('cerrar')">
    <div class="filtros-en-hoja">
      <SelectorSegmentado
        :model-value="estado"
        :opciones="OPCIONES_DE_ESTADO"
        etiqueta="Mostrar"
        @update:model-value="emit('update:estado', $event)"
      />
      <div class="categorias">
        <BotonesDeOpcion
          :model-value="categoriaId"
          :opciones="opcionesDeCategoria"
          etiqueta="Categoría"
          @update:model-value="emit('update:categoriaId', $event)"
        />
      </div>
    </div>
    <template #pie="{ cerrar }">
      <BotonPrincipal :texto="textoDelBoton" @click="cerrar()" />
    </template>
  </HojaInferior>
</template>

<style scoped>
.filtros-en-hoja {
  display: grid;
  gap: var(--espacio-5);
  min-inline-size: 0;
}
/* Diez categorías con nombres largos: a la letra base para que en 320 px con letra Muy grande
   cada palabra entre entera. */
.categorias :deep(.opcion) {
  font-size: 1rem;
}
</style>
