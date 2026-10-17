<!-- eslint-disable vue/multi-word-component-names -- nombre exigido por el plan ("Tarjeta") -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

withDefaults(defineProps<{ comoBoton?: boolean }>(), { comoBoton: false })
const emit = defineEmits<{ click: [evento: MouseEvent] }>()

const refContenido = ref<HTMLElement>()
/** El nombre del botón: los textos del contenido, separados por espacios. */
const nombre = ref('')
let observador: MutationObserver | undefined

function textoConSeparadores(elemento: HTMLElement): string {
  const partes: string[] = []
  const recorrido = document.createTreeWalker(elemento, NodeFilter.SHOW_TEXT)
  for (let nodo = recorrido.nextNode(); nodo; nodo = recorrido.nextNode()) {
    const texto = nodo.textContent?.replace(/\s+/g, ' ').trim()
    if (texto) partes.push(texto)
  }
  return partes.join(' ')
}

function actualizarNombre(): void {
  if (refContenido.value) nombre.value = textoConSeparadores(refContenido.value)
}

onMounted(() => {
  if (!refContenido.value) return
  actualizarNombre()
  // Lo que dice la tarjeta puede cambiar (otro stock, otro precio): el nombre lo sigue.
  observador = new MutationObserver(actualizarNombre)
  observador.observe(refContenido.value, { childList: true, characterData: true, subtree: true })
})
onBeforeUnmount(() => observador?.disconnect())
</script>

<template>
  <div v-if="!comoBoton" class="tarjeta">
    <slot />
  </div>
  <!--
    Plan 17: un <button> solo admite contenido de frase, y una tarjeta lleva títulos y párrafos.
    Así que el contenido va afuera del botón, y el botón (vacío, encima de toda la tarjeta: se
    toca en cualquier parte) se llama como lo que dice la tarjeta (aria-label con sus textos
    separados por espacios). El contenido va con aria-hidden: el lector no lo lee dos veces. Lo
    que va en la tarjeta no debe ser interactivo (quedaría debajo del botón).
  -->
  <div v-else class="tarjeta tarjeta--boton">
    <div ref="refContenido" class="contenido" aria-hidden="true">
      <slot />
    </div>
    <button type="button" class="tocar" :aria-label="nombre" @click="emit('click', $event)" />
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
