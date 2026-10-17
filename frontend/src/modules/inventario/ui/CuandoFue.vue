<script setup lang="ts">
import { computed } from 'vue'
import CampoTexto from '@/shared/ui/componentes/CampoTexto.vue'
import SelectorSegmentado from '@/shared/ui/componentes/SelectorSegmentado.vue'
import { diasPermitidos, type Cuando, type ErrorDeFecha } from './cuando'
import { hoyEnLaTienda } from '@/shared/domain/fecha'

/**
 * RN-OP-09 / HU-OP-07: "¿Cuándo fue?" — por defecto ahora; con "Otro día" se eligen el día (de
 * hace 7 días a hoy) y la hora. Cada error va junto a su campo: sin hora, debajo de la hora;
 * los límites del dominio (7 días, nunca futura), debajo del día.
 */
const props = withDefaults(
  defineProps<{
    modelValue: Cuando
    /** "¿Cuándo fue la venta?" */
    pregunta: string
    error?: ErrorDeFecha
  }>(),
  { error: undefined },
)
const emit = defineEmits<{ 'update:modelValue': [valor: Cuando] }>()

const OPCIONES = [
  { valor: 'ahora', etiqueta: 'Ahora' },
  { valor: 'otro', etiqueta: 'Otro día' },
] as const

const otroDia = computed(() => props.modelValue.modo === 'otro')
const limites = computed(() => diasPermitidos(hoyEnLaTienda(new Date())))
const errorDia = computed(() => (props.error?.campo === 'dia' ? props.error.mensaje : undefined))
const errorHora = computed(() => (props.error?.campo === 'hora' ? props.error.mensaje : undefined))

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
    <div v-if="otroDia" class="fecha-y-hora">
      <CampoTexto
        tipo="date"
        etiqueta="Día"
        :model-value="modelValue.dia"
        :min="limites.min"
        :max="limites.max"
        :error="errorDia"
        @update:model-value="cambiar({ dia: $event })"
      />
      <CampoTexto
        tipo="time"
        etiqueta="Hora"
        :model-value="modelValue.hora"
        :error="errorHora"
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
