<script setup lang="ts">// eslint-disable-line vue/multi-word-component-names -- nombre exigido por el plan
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    texto: string
    icono?: Component
    variante?: 'primario' | 'secundario' | 'peligro'
    deshabilitado?: boolean
    tipo?: 'button' | 'submit'
  }>(),
  {
    icono: undefined,
    variante: 'secundario',
    deshabilitado: false,
    tipo: 'button',
  },
)
const emit = defineEmits<{ click: [evento: MouseEvent] }>()
</script>

<template>
  <button
    :type="tipo"
    class="boton"
    :class="`boton--${variante}`"
    :disabled="deshabilitado"
    @click="emit('click', $event)"
  >
    <component :is="icono" v-if="icono" class="icono" aria-hidden="true" />
    <span>{{ texto }}</span>
  </button>
</template>

<style scoped>
.boton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--espacio-2);
  width: auto;
  min-height: var(--alto-toque);
  padding-inline: var(--espacio-4);
  border-radius: var(--radio-chico);
  border: 2px solid transparent;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}
.boton:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.boton--primario {
  background: var(--color-primario);
  color: var(--color-primario-texto);
}
.boton--secundario {
  background: var(--color-superficie);
  color: var(--color-texto);
  border-color: var(--color-borde);
}
.boton--peligro {
  background: var(--color-peligro-suave);
  color: var(--color-peligro);
  border-color: var(--color-peligro);
}
.icono {
  width: 1.25em;
  height: 1.25em;
  flex: none;
}
</style>
