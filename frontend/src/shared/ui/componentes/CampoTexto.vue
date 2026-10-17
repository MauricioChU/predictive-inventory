<script setup lang="ts">
import { useId } from 'vue'

withDefaults(
  defineProps<{
    etiqueta: string
    modelValue: string
    error?: string
    ayuda?: string
    tipo?: string
    autocompletar?: string
    /** Plan 12 (r1 M6): límites de un campo de fecha u hora ("2026-10-08"). */
    min?: string
    max?: string
  }>(),
  {
    error: undefined,
    ayuda: undefined,
    tipo: 'text',
    autocompletar: undefined,
    min: undefined,
    max: undefined,
  },
)
defineEmits<{ 'update:modelValue': [valor: string] }>()
const id = useId()
const idError = `${id}-error`
const idAyuda = `${id}-ayuda`
</script>

<template>
  <div class="campo-texto">
    <label :for="id" class="etiqueta">{{ etiqueta }}</label>
    <input
      :id="id"
      :type="tipo"
      :value="modelValue"
      :autocomplete="autocompletar"
      :min="min"
      :max="max"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? idError : ayuda ? idAyuda : undefined"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <p v-if="ayuda && !error" :id="idAyuda" class="ayuda">{{ ayuda }}</p>
    <p v-if="error" :id="idError" class="error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.etiqueta {
  display: block;
  font-weight: 700;
  margin-bottom: var(--espacio-2);
}
input {
  width: 100%;
  min-height: var(--alto-toque);
  padding-inline: var(--espacio-3);
  border: 2px solid var(--color-borde);
  border-radius: var(--radio-chico);
  background: var(--color-fondo);
  font-size: 1.125rem;
}
input[aria-invalid='true'] {
  border-color: var(--color-peligro);
}
.ayuda {
  color: var(--color-texto-suave);
  margin: var(--espacio-2) 0 0;
}
.error {
  color: var(--color-peligro);
  font-weight: 700;
  margin: var(--espacio-2) 0 0;
}
</style>
