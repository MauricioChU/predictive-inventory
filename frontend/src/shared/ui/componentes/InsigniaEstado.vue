<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheck, CircleX, TriangleAlert } from 'lucide-vue-next'
import { PRESENTACION_DE_ESTADO, type EstadoVisual } from '../presentacion-estado'

const props = defineProps<{ estado: EstadoVisual }>()
const presentacion = computed(() => PRESENTACION_DE_ESTADO[props.estado])
const ICONOS = { 'círculo-x': CircleX, advertencia: TriangleAlert, check: CircleCheck } as const
const icono = computed(() => ICONOS[presentacion.value.icono])
</script>

<template>
  <span class="insignia" :class="presentacion.claseCss">
    <component :is="icono" aria-hidden="true" class="icono" />
    <span>{{ presentacion.texto }}</span>
  </span>
</template>

<style scoped>
.insignia {
  display: inline-flex;
  align-items: center;
  gap: var(--espacio-1);
  padding: var(--espacio-1) var(--espacio-3);
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.95rem;
}
.icono {
  width: 1.1em;
  height: 1.1em;
  flex: none;
}
.estado-agotado {
  background: var(--color-peligro-suave);
  color: var(--color-peligro);
}
.estado-por-acabarse {
  background: var(--color-advertencia-suave);
  color: var(--color-advertencia);
}
.estado-normal {
  background: var(--color-exito-suave);
  color: var(--color-exito);
}
</style>
