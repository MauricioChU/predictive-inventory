<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronRight, CircleCheck, Info, TriangleAlert } from 'lucide-vue-next'
import { pegarCifras } from '../texto-sin-cortes'

/** Un aviso del carrusel: tono, texto corto y, si se puede tocar, el nombre accesible de su acción. */
export interface AvisoDelCarrusel {
  id: string
  tono: 'atencion' | 'info' | 'exito'
  texto: string
  textoAccion?: string
}

/**
 * Avisos en un espacio reservado: un solo bloque con un aviso a la vez. Con `textoAccion`, TODO el
 * bloque es un botón que emite `accion` con el `id` del aviso. Con varios, a la derecha va un «1/3»
 * pequeño y un botón aparte (hermano, no anidado; 48 × 48 px reales) que pasa al siguiente y da la
 * vuelta al final (RN-UX-05: no hace falta deslizar, aunque deslizar de lado también funciona).
 * Con un solo aviso no hay flecha ni contador. El alto es fijo: cambiar de aviso no mueve lo de abajo.
 */
const props = defineProps<{ avisos: AvisoDelCarrusel[]; etiqueta: string }>()
const emit = defineEmits<{ accion: [id: string] }>()

const ICONOS = { atencion: TriangleAlert, info: Info, exito: CircleCheck } as const

const posicion = ref(0)
const varios = computed(() => props.avisos.length > 1)
const indice = computed(() => Math.min(posicion.value, props.avisos.length - 1))
const actual = computed(() => props.avisos[indice.value])
const siguienteNumero = computed(() => ((indice.value + 1) % props.avisos.length) + 1)

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
/** Tras deslizar, el «click» que el navegador suelta sobre el bloque no debe abrir el aviso. */
let deslizo = false
function alTocar(evento: PointerEvent): void {
  deslizo = false
  inicioX = evento.clientX
  inicioY = evento.clientY
}
function alSoltar(evento: PointerEvent): void {
  if (inicioX === null) return
  const dx = evento.clientX - inicioX
  const dy = evento.clientY - inicioY
  inicioX = null
  if (Math.abs(dx) > 48 && Math.abs(dx) > 2 * Math.abs(dy)) {
    deslizo = true
    mover(dx < 0 ? 1 : -1)
  }
}
function alTocarAviso(): void {
  if (deslizo) deslizo = false
  else if (actual.value) emit('accion', actual.value.id)
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
    <div class="tarjeta">
      <div
        class="aviso-actual"
        :aria-live="varios ? 'polite' : undefined"
        @pointerdown="alTocar"
        @pointerup="alSoltar"
        @pointercancel="inicioX = null"
      >
        <Transition name="aviso" mode="out-in">
          <component
            :is="actual.textoAccion ? 'button' : 'div'"
            :key="actual.id"
            class="aviso"
            :class="{ 'aviso--tocable': actual.textoAccion }"
            :type="actual.textoAccion ? 'button' : undefined"
            :aria-label="actual.textoAccion"
            @click="actual.textoAccion ? alTocarAviso() : undefined"
          >
            <component :is="ICONOS[actual.tono]" aria-hidden="true" class="icono" />
            <span class="texto">{{ pegarCifras(actual.texto) }}</span>
            <!-- Un solo aviso tocable: la flecha dice que lleva a otra pantalla (decorativa). -->
            <ChevronRight
              v-if="actual.textoAccion && !varios"
              aria-hidden="true"
              class="icono-ir"
            />
          </component>
        </Transition>
      </div>
      <div v-if="varios" class="siguiente">
        <span class="contador" aria-hidden="true">{{ indice + 1 }}/{{ avisos.length }}</span>
        <button
          type="button"
          class="paso"
          :aria-label="`Siguiente aviso, ${siguienteNumero} de ${avisos.length}`"
          @click="mover(1)"
        >
          <ChevronRight aria-hidden="true" class="icono-paso" />
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.carrusel {
  --tono: var(--color-primario);
  --tono-suave: var(--color-primario-suave);
}
.carrusel--atencion {
  --tono: var(--color-advertencia);
  --tono-suave: var(--color-advertencia-suave);
}
.carrusel--exito {
  --tono: var(--color-exito);
  --tono-suave: var(--color-exito-suave);
}
/* Un solo bloque: marco, borde grueso a la izquierda y fondo del tono del aviso. */
.tarjeta {
  display: flex;
  align-items: stretch;
  min-block-size: var(--alto-toque);
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
  display: flex;
  flex: 1;
  min-inline-size: 0;
}
.aviso {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--espacio-2);
  min-inline-size: 0;
  min-block-size: var(--alto-toque);
  padding: 0 var(--espacio-2);
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
}
.aviso--tocable {
  cursor: pointer;
  border-radius: var(--radio-chico);
}
.icono {
  inline-size: 1.25rem;
  block-size: 1.25rem;
  flex: none;
  color: var(--tono);
}
.texto {
  flex: 1;
  min-inline-size: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  overflow-wrap: break-word;
}
.icono-ir {
  inline-size: 1.5rem;
  block-size: 1.5rem;
  flex: none;
  color: var(--tono);
}
.siguiente {
  display: flex;
  flex: none;
  align-items: center;
}
.contador {
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-texto-suave);
}
.paso {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: var(--alto-toque);
  block-size: var(--alto-toque);
  padding: 0;
  border: none;
  border-radius: var(--radio-chico);
  background: none;
  color: var(--tono);
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
