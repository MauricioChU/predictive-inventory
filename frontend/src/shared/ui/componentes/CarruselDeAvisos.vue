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
 * fila, sin controles. Con varios, el aviso y sus controles (‹ puntos ›) son UNA tarjeta: el
 * marco y el fondo envuelven la fila y, debajo, la tira de puntos. El alto es fijo: cambiar de
 * aviso no mueve lo de abajo.
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
    :class="[`carrusel--${actual.tono}`, { 'carrusel--varios': varios }]"
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
          :plana="varios"
          :tono="actual.tono"
          :texto="actual.texto"
          :texto-accion="actual.textoAccion"
          @accion="emit('accion', actual.id)"
        />
      </Transition>
    </div>
    <!-- Tira delgada (≈ 20 px visibles) dentro de la tarjeta: ‹ puntos ›. Cada uno es tocable con una zona de 48 px de
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
  --tono: var(--color-primario);
  --tono-suave: var(--color-primario-suave);
  display: flex;
  flex-direction: column;
}
.carrusel--atencion {
  --tono: var(--color-advertencia);
  --tono-suave: var(--color-advertencia-suave);
}
.carrusel--exito {
  --tono: var(--color-exito);
  --tono-suave: var(--color-exito-suave);
}
/* Varios avisos: una sola tarjeta (marco, borde grueso a la izquierda y fondo del tono) que
   envuelve el aviso y la tira de puntos; los puntos no flotan solos debajo. */
.carrusel--varios {
  border: 2px solid var(--tono);
  border-inline-start-width: 5px;
  border-radius: var(--radio);
  background: var(--tono-suave);
  color: var(--color-texto);
}
.carrusel--varios .aviso-actual {
  touch-action: pan-y;
}
.aviso-actual {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
}
.controles {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  block-size: 20px;
  /* Un hilo suave separa el aviso de los puntos, dentro de la misma tarjeta. */
  margin-inline: var(--espacio-2);
  border-block-start: 1px solid color-mix(in srgb, var(--tono) 35%, transparent);
}
.puntos {
  display: flex;
  align-items: center;
}
.paso,
.punto {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* Cajas reales de 48 × 48 px; los márgenes negativos hacen que la tira siga midiendo ~20 px
     (sobresalen 22 px arriba y 6 abajo: no suman alto; la fila del aviso va encima y conserva toda su flecha). */
  inline-size: var(--alto-toque);
  block-size: var(--alto-toque);
  margin-block: -22px -6px;
  /* Las cajas se pisan por los lados para que la fila sea angosta; la zona efectiva queda en ~28 px. */
  margin-inline: -10px;
  /* El dibujo queda centrado en la tira (20 px) aunque la caja de 48 px sobresalga más arriba que abajo. */
  padding: 16px 0 0;
  border: none;
  background: none;
  color: var(--tono);
  cursor: pointer;
  /* Si hay una barra pegada abajo (Inicio: «Vender»), enfocar un control no lo deja debajo de ella. */
  scroll-margin-block-end: calc(var(--alto-boton-principal) + 5 * var(--espacio-2));
}
.icono-paso {
  inline-size: 24px;
  block-size: 24px;
}
/* El actual es un punto lleno y más grande; los demás, un aro: no depende solo del color. */
.marca {
  inline-size: 0.6rem;
  block-size: 0.6rem;
  border: 2px solid var(--tono);
  border-radius: 999px;
}
.marca--actual {
  inline-size: 0.85rem;
  block-size: 0.85rem;
  background: var(--tono);
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
