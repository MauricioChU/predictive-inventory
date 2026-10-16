<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { ChevronDown, ChevronUp } from 'lucide-vue-next'
import Boton from '@/shared/ui/componentes/Boton.vue'
import BotonesDeOpcion from '@/shared/ui/componentes/BotonesDeOpcion.vue'
import type { CategoriaVista } from '../application/modulo'

const props = defineProps<{
  /** v-model: id de la categoría elegida, o '' para todas. */
  modelValue: string
  categorias: readonly CategoriaVista[]
}>()
const emit = defineEmits<{ 'update:modelValue': [categoriaId: string] }>()

const abierto = ref(false)
const idPanel = useId()
const refBoton = ref<InstanceType<typeof Boton>>()

const nombreElegido = computed(
  () => props.categorias.find((c) => c.id === props.modelValue)?.nombre ?? 'Todas',
)
const opciones = computed(() => [
  { valor: '', etiqueta: 'Todas las categorías' },
  ...props.categorias.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
])

/**
 * Un toque (o Enter/Espacio) en una opción la elige y cierra la lista, también si ya era la
 * elegida; con las flechas solo se recorre (no se cierra). El foco vuelve al botón.
 */
function alTocarPanel(evento: MouseEvent) {
  if (!(evento.target as HTMLElement).closest('[role="radio"]')) return
  abierto.value = false
  void nextTick(() => (refBoton.value?.$el as HTMLElement | undefined)?.focus())
}
</script>

<template>
  <!-- RN-UX-05: la lista de categorías se abre con un botón visible (sin gestos). -->
  <div class="filtro-de-categoria">
    <Boton
      ref="refBoton"
      class="abrir"
      :texto="`Categoría: ${nombreElegido}`"
      :icono="abierto ? ChevronUp : ChevronDown"
      :aria-expanded="abierto ? 'true' : 'false'"
      :aria-controls="abierto ? idPanel : undefined"
      @click="abierto = !abierto"
    />
    <div v-if="abierto" :id="idPanel" class="panel" @click="alTocarPanel">
      <BotonesDeOpcion
        :model-value="modelValue"
        :opciones="opciones"
        etiqueta="¿Qué categoría quieres ver?"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.filtro-de-categoria {
  display: grid;
  /* minmax(0, 1fr): una palabra larga de una categoría no ensancha la columna (RN-UX-09). */
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-3);
  min-inline-size: 0;
}
.abrir {
  inline-size: 100%;
  justify-content: space-between;
  text-align: start;
  /* El nombre de una categoría larga se envuelve entre palabras, el ícono queda al costado. */
  flex-direction: row-reverse;
  padding-block: var(--espacio-2);
}
.panel {
  padding-block-end: var(--espacio-3);
  border-block-end: 2px solid var(--color-borde);
}
/* Diez categorías con nombres largos ("Ambientadores e insecticidas"): a la letra base (nunca
   menos, RN-UX-01) para que en 320 px con letra Muy grande cada palabra entre entera. */
.panel :deep(.opcion) {
  font-size: 1rem;
}
</style>
