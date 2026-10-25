<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import FilaDeAviso from './FilaDeAviso.vue'

/** Un aviso del carrusel: lo mismo que `FilaDeAviso`, con un `id` para saber cuál se tocó. */
export interface AvisoDelCarrusel {
  id: string
  tono: 'atencion' | 'info' | 'exito'
  texto: string
  textoAccion?: string
}

/**
 * Avisos en un espacio reservado: uno a la vez, con ‹ › y "1 de 3" siempre a la vista (RN-UX-05:
 * no hace falta deslizar, aunque deslizar de lado también funciona). Con un solo aviso es solo la
 * fila, sin controles. Con varios, el alto es fijo: cambiar de aviso no mueve lo de abajo.
 */
const props = defineProps<{ avisos: AvisoDelCarrusel[]; etiqueta: string }>()
const emit = defineEmits<{ accion: [id: string] }>()

const posicion = ref(0)
const varios = computed(() => props.avisos.length > 1)
const actual = computed(() => props.avisos[Math.min(posicion.value, props.avisos.length - 1)])

// Si hay menos avisos que antes, no se queda en uno que ya no existe.
watch(
  () => props.avisos.length,
  (total) => {
    if (posicion.value >= total) posicion.value = Math.max(0, total - 1)
  },
)

function mover(paso: 1 | -1): void {
  const total = props.avisos.length
  posicion.value = (posicion.value + paso + total) % total
}

// Deslizar de lado (extra): un gesto horizontal claro cambia de aviso.
let inicioX: number | null = null
let inicioY = 0
function alTocar(evento: PointerEvent): void {
  inicioX = evento.clientX
  inicioY = evento.clientY
}
function alSoltar(evento: PointerEvent): void {
  if (inicioX === null) return
  const dx = evento.clientX - inicioX
  const dy = evento.clientY - inicioY
  inicioX = null
  if (Math.abs(dx) > 48 && Math.abs(dx) > 2 * Math.abs(dy)) mover(dx < 0 ? 1 : -1)
}
</script>

<template>
  <section
    v-if="actual"
    class="carrusel"
    :class="{ 'carrusel--varios': varios }"
    aria-roledescription="carrusel"
    :aria-label="etiqueta"
  >
    <div
      class="aviso-actual"
      :aria-live="varios ? 'polite' : undefined"
      @pointerdown="alTocar"
      @pointerup="alSoltar"
      @pointercancel="inicioX = null"
    >
      <Transition name="aviso" mode="out-in">
        <FilaDeAviso
          :key="actual.id"
          :tono="actual.tono"
          :texto="actual.texto"
          :texto-accion="actual.textoAccion"
          @accion="emit('accion', actual.id)"
        />
      </Transition>
    </div>
    <!-- Fila delgada (≈ 24 px visibles): ‹ puntos ›. Cada uno es tocable con una zona de 48 px de
         alto que sale por ::after, sin agrandar la fila. -->
    <div v-if="varios" class="controles">
      <button type="button" class="paso" aria-label="Aviso anterior" @click="mover(-1)">
        <ChevronLeft aria-hidden="true" class="icono-paso" />
      </button>
      <div class="puntos">
        <button
          v-for="(aviso, indice) in avisos"
          :key="aviso.id"
          type="button"
          class="punto"
          :aria-label="`Aviso ${indice + 1} de ${avisos.length}`"
          :aria-current="indice === posicion ? 'true' : undefined"
          @click="posicion = indice"
        >
          <span class="marca" :class="{ 'marca--actual': indice === posicion }" />
        </button>
      </div>
      <button type="button" class="paso" aria-label="Aviso siguiente" @click="mover(1)">
        <ChevronRight aria-hidden="true" class="icono-paso" />
      </button>
      <p class="solo-lector">{{ posicion + 1 }} de {{ avisos.length }}</p>
    </div>
  </section>
</template>

<style scoped>
.carrusel {
  display: flex;
  flex-direction: column;
}
/* La fila de controles aprovecha el hueco que ya hay bajo el carrusel: no estira la pantalla. */
.carrusel--varios {
  margin-block-end: calc(-1 * var(--espacio-2));
}
.carrusel--varios .aviso-actual {
  touch-action: pan-y;
}
.aviso-actual {
  display: flex;
  flex-direction: column;
}
.controles {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--espacio-2);
  block-size: 24px;
}
.puntos {
  display: flex;
  align-items: center;
}
.paso,
.punto {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  block-size: 24px;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-primario);
  cursor: pointer;
  /* Si hay una barra pegada abajo (Inicio: «Vender»), enfocar un control no lo deja debajo de ella. */
  scroll-margin-block-end: calc(var(--alto-boton-principal) + 3 * var(--espacio-2));
}
.paso {
  inline-size: 2rem;
}
.punto {
  inline-size: 1.75rem;
}
/* La zona de toque llega a 48 px de alto sin sumar alto a la fila. */
.paso::after,
.punto::after {
  content: '';
  position: absolute;
  inset-inline: 0;
  inset-block: calc((24px - var(--alto-toque)) / 2);
}
.icono-paso {
  inline-size: 24px;
  block-size: 24px;
}
/* El actual es un punto lleno y más grande; los demás, un aro: no depende solo del color. */
.marca {
  inline-size: 0.6rem;
  block-size: 0.6rem;
  border: 2px solid var(--color-primario);
  border-radius: 999px;
}
.marca--actual {
  inline-size: 0.85rem;
  block-size: 0.85rem;
  background: var(--color-primario);
}
/* Cambio de aviso: el que se va se aclara y el nuevo entra con un fundido corto. */
.aviso-enter-active,
.aviso-leave-active {
  transition:
    opacity var(--duracion-vista-sale) ease-out,
    transform var(--duracion-vista-sale) ease-out;
}
.aviso-enter-from,
.aviso-leave-to {
  opacity: 0;
  transform: translateX(0.5rem);
}
</style>
