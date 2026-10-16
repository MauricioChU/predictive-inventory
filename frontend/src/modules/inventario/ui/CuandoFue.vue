<script setup lang="ts">
import { computed, useId } from 'vue'
import CampoTexto from '@/shared/ui/componentes/CampoTexto.vue'
import SelectorSegmentado from '@/shared/ui/componentes/SelectorSegmentado.vue'
import type { Cuando } from './cuando'

/**
 * RN-OP-09 / HU-OP-07: "¿Cuándo fue?" — por defecto ahora; con "Otro día" se eligen el día y la
 * hora (hasta 7 días atrás, nunca futura: lo valida el dominio y su mensaje va junto al día).
 */
const props = withDefaults(
  defineProps<{
    modelValue: Cuando
    /** "¿Cuándo fue la venta?" */
    pregunta: string
    error?: string
  }>(),
  { error: undefined },
)
const emit = defineEmits<{ 'update:modelValue': [valor: Cuando] }>()

const OPCIONES = [
  { valor: 'ahora', etiqueta: 'Ahora' },
  { valor: 'otro', etiqueta: 'Otro día' },
] as const

const id = useId()
const otroDia = computed(() => props.modelValue.modo === 'otro')

function cambiar(cambios: Partial<Cuando>): void {
  emit('update:modelValue', { ...props.modelValue, ...cambios })
}
</script>

<template>
  <div class="cuando-fue">
    <SelectorSegmentado
      :model-value="modelValue.modo"
      :opciones="OPCIONES"
      :etiqueta="pregunta"
      @update:model-value="cambiar({ modo: $event })"
    />
    <div v-if="otroDia" :id="id" class="fecha-y-hora">
      <CampoTexto
        tipo="date"
        etiqueta="Día"
        :model-value="modelValue.dia"
        :error="error"
        @update:model-value="cambiar({ dia: $event })"
      />
      <CampoTexto
        tipo="time"
        etiqueta="Hora"
        :model-value="modelValue.hora"
        @update:model-value="cambiar({ hora: $event })"
      />
    </div>
  </div>
</template>

<style scoped>
.cuando-fue {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-3);
}
.fecha-y-hora {
  display: flex;
  flex-wrap: wrap;
  gap: var(--espacio-3);
}
.fecha-y-hora > * {
  flex: 1 1 10rem;
  min-inline-size: 0;
}
</style>
