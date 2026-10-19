<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    etiqueta: string
    /** El día del mes elegido (1 a 31), o `null` mientras no se haya elegido. */
    modelValue: number | null
    error?: string
  }>(),
  { error: undefined },
)
const emit = defineEmits<{ 'update:modelValue': [valor: number | null] }>()

const id = useId()
const idError = `${id}-error`
const DIAS = Array.from({ length: 31 }, (_, i) => i + 1)
const valor = computed(() => (props.modelValue === null ? '' : String(props.modelValue)))

function alElegir(evento: Event): void {
  const elegido = (evento.target as HTMLSelectElement).value
  emit('update:modelValue', elegido === '' ? null : Number(elegido))
}
</script>

<template>
  <div class="selector-de-dia">
    <label :for="id" class="etiqueta">{{ etiqueta }}</label>
    <!-- <select> nativo: en el celular abre la lista del sistema (grande, con su propio teclado). -->
    <select
      :id="id"
      :value="valor"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? idError : undefined"
      @change="alElegir"
    >
      <option value="">Elige un día</option>
      <option v-for="dia in DIAS" :key="dia" :value="String(dia)">{{ dia }}</option>
    </select>
    <p v-if="error" :id="idError" class="error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.etiqueta {
  display: block;
  font-weight: 700;
  margin-bottom: var(--espacio-2);
}
select {
  width: 100%;
  min-height: var(--alto-boton-principal);
  padding-inline: var(--espacio-3);
  border: 2px solid var(--color-borde);
  border-radius: var(--radio-chico);
  background: var(--color-fondo);
  color: var(--color-texto);
  font: inherit;
  font-size: 1.125rem;
}
select[aria-invalid='true'] {
  border-color: var(--color-peligro);
}
.error {
  color: var(--color-peligro);
  font-weight: 700;
  margin: var(--espacio-2) 0 0;
}
</style>
