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
    <div v-if="varios" class="controles">
      <button type="button" class="paso" aria-label="Aviso anterior" @click="mover(-1)">
        <ChevronLeft aria-hidden="true" class="icono-paso" />
      </button>
      <p class="posicion">{{ posicion + 1 }} de {{ avisos.length }}</p>
      <button type="button" class="paso" aria-label="Aviso siguiente" @click="mover(1)">
        <ChevronRight aria-hidden="true" class="icono-paso" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.carrusel {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-1);
}
.carrusel--varios .aviso-actual {
  /* Alto reservado: el aviso llena el espacio y cambiar de uno a otro no mueve nada. */
  block-size: 4.5rem;
  touch-action: pan-y;
}
.aviso-actual {
  display: flex;
  flex-direction: column;
}
.aviso-actual :deep(.fila-de-aviso) {
  flex: 1;
}
.controles {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--espacio-3);
}
.posicion {
  min-inline-size: 5rem;
  margin: 0;
  color: var(--color-texto);
  font-weight: 700;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.paso {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-inline-size: var(--alto-toque);
  min-block-size: var(--alto-toque);
  border: 2px solid var(--color-borde);
  border-radius: var(--radio-chico);
  background: var(--color-fondo);
  color: var(--color-primario);
  cursor: pointer;
}
.icono-paso {
  inline-size: 1.5rem;
  block-size: 1.5rem;
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
