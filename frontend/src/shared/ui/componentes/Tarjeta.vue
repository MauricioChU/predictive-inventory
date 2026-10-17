<!-- eslint-disable vue/multi-word-component-names -- nombre exigido por el plan ("Tarjeta") -->
<script setup lang="ts">
import { useId } from 'vue'

withDefaults(defineProps<{ comoBoton?: boolean }>(), { comoBoton: false })
const emit = defineEmits<{ click: [evento: MouseEvent] }>()

const idContenido = useId()
</script>

<template>
  <div v-if="!comoBoton" class="tarjeta">
    <slot />
  </div>
  <!--
    Plan 17: un <button> solo admite contenido de frase, y una tarjeta lleva títulos y párrafos.
    Así que el contenido va afuera del botón, y el botón (vacío, encima de toda la tarjeta: se
    toca en cualquier parte) toma su nombre de ese contenido con aria-labelledby. Lo que va en
    la tarjeta no debe ser interactivo (quedaría debajo del botón).
  -->
  <div v-else class="tarjeta tarjeta--boton">
    <div :id="idContenido" class="contenido">
      <slot />
    </div>
    <button
      type="button"
      class="tocar"
      :aria-labelledby="idContenido"
      @click="emit('click', $event)"
    />
  </div>
</template>

<style scoped>
.tarjeta {
  display: block;
  width: 100%;
  background: var(--color-superficie);
  border-radius: var(--radio);
  padding: var(--espacio-4);
  text-align: left;
  color: inherit;
}
.tarjeta--boton {
  position: relative;
  min-block-size: var(--alto-toque);
}
.tarjeta--boton:hover {
  background: var(--color-primario-suave);
}
.tocar {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  padding: 0;
  border: none;
  border-radius: inherit;
  background: transparent;
  cursor: pointer;
}
.tocar:focus-visible {
  outline: 3px solid var(--color-foco);
  outline-offset: 2px;
}
</style>
