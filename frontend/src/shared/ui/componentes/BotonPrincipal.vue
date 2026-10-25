<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    texto: string
    icono?: Component
    variante?: 'primario' | 'secundario' | 'peligro'
    deshabilitado?: boolean
    tipo?: 'button' | 'submit'
    /** Propuesta Inicio: botón muy redondeado (pastilla). */
    pastilla?: boolean
  }>(),
  {
    icono: undefined,
    variante: 'primario',
    deshabilitado: false,
    tipo: 'button',
    pastilla: false,
  },
)
const emit = defineEmits<{ click: [evento: MouseEvent] }>()
</script>

<template>
  <button
    :type="tipo"
    class="boton-principal"
    :class="[`boton-principal--${variante}`, { 'boton-principal--pastilla': pastilla }]"
    :disabled="deshabilitado"
    @click="emit('click', $event)"
  >
    <component :is="icono" v-if="icono" class="icono" aria-hidden="true" />
    <span>{{ texto }}</span>
  </button>
</template>

<style scoped>
.boton-principal {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--espacio-2);
  width: 100%;
  min-height: var(--alto-boton-principal);
  /* Plan 13: el botón ya ocupa todo el ancho y centra su texto; con más relleno, a 320 px con
     letra Muy grande una palabra larga ("Compartir" en BarraDeTotal) no cabía y se partía. */
  padding-inline: var(--espacio-3);
  border-radius: var(--radio);
  border: 2px solid transparent;
  font-size: 1.125rem;
  font-weight: 700;
  cursor: pointer;
}
.boton-principal:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.boton-principal--primario {
  background: var(--color-primario);
  color: var(--color-primario-texto);
}
.boton-principal--secundario {
  background: var(--color-primario-suave);
  color: var(--color-primario);
  border-color: var(--color-primario);
}
.boton-principal--peligro {
  background: var(--color-peligro);
  color: var(--color-primario-texto);
}
.boton-principal--pastilla {
  border-radius: var(--radio-pastilla);
}
.icono {
  width: 1.5em;
  height: 1.5em;
  flex: none;
}
</style>
