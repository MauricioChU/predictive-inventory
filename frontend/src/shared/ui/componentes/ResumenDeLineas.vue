<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { pegarCifras } from '../texto-sin-cortes'

/** Una línea de lo que se registró: "2 unid. × S/ 3.50", su importe y, si va, una marca. */
export interface LineaDeResumen {
  id: string
  nombre: string
  detalle: string
  importe: string
  /** Marca de la línea: "Precio especial" (venta) o "Costo nuevo" (llegada). */
  marca?: string
}

const props = defineProps<{ lineas: LineaDeResumen[]; etiqueta: string }>()

/** A la vista caben, como mucho, estas líneas; las demás se alcanzan desplazando dentro de la tarjeta. */
const LINEAS_A_LA_VISTA = 4

const desplazable = ref<HTMLElement | null>(null)
const lista = ref<HTMLElement | null>(null)
/** Alto exacto de las primeras 4 líneas (medido: un nombre largo puede ocupar dos renglones). */
const altoMaximo = ref<string | null>(null)
const alFinal = ref(false)

const sobran = computed(() => Math.max(0, props.lineas.length - LINEAS_A_LA_VISTA))
const desborda = computed(() => sobran.value > 0)
/** Lo que falta por ver debajo: baja al desplazar hasta el final. */
const faltan = computed(() => (alFinal.value ? 0 : sobran.value))

function medir(): void {
  const caja = desplazable.value
  const filas = lista.value?.children
  if (!caja || !filas || filas.length <= LINEAS_A_LA_VISTA) {
    altoMaximo.value = null
    return
  }
  const cuarta = filas[LINEAS_A_LA_VISTA - 1] as HTMLElement
  const relleno = Number.parseFloat(getComputedStyle(caja).paddingBottom) || 0
  altoMaximo.value = `${cuarta.offsetTop + cuarta.offsetHeight + relleno}px`
  void nextTick(revisarFinal)
}

function revisarFinal(): void {
  const caja = desplazable.value
  if (!caja) return
  alFinal.value = caja.scrollTop + caja.clientHeight >= caja.scrollHeight - 2
}

let observador: ResizeObserver | undefined
onMounted(() => {
  medir()
  if (typeof ResizeObserver !== 'undefined' && desplazable.value) {
    observador = new ResizeObserver(medir)
    observador.observe(desplazable.value)
  }
})
onBeforeUnmount(() => observador?.disconnect())
watch(
  () => props.lineas.length,
  () => void nextTick(medir),
)
</script>

<template>
  <div v-if="lineas.length > 0" class="resumen-de-lineas" :class="{ desborda }">
    <!-- Con más de 4 líneas es una región que se desplaza (con el teclado también: Tab y flechas). -->
    <div
      ref="desplazable"
      class="desplazable"
      :style="altoMaximo ? { maxBlockSize: altoMaximo } : undefined"
      :role="desborda ? 'region' : undefined"
      :aria-label="desborda ? `${etiqueta}: ${lineas.length} productos` : undefined"
      :tabindex="desborda ? 0 : undefined"
      @scroll.passive="revisarFinal"
    >
      <ul ref="lista" :aria-label="desborda ? undefined : etiqueta">
        <li v-for="linea in lineas" :key="linea.id" class="linea">
          <span class="nombre">{{ linea.nombre }}</span>
          <span class="importe">{{ linea.importe }}</span>
          <span class="detalle">
            {{ pegarCifras(linea.detalle)
            }}<template v-if="linea.marca"> · {{ linea.marca }}</template>
          </span>
        </li>
      </ul>
    </div>
    <p v-if="desborda" class="pista" :class="{ 'pista--final': faltan === 0 }" aria-hidden="true">
      <template v-if="faltan > 0">
        <span>y {{ faltan }} más</span>
        <ChevronDown class="icono-pista" />
      </template>
      <span v-else>Ya viste todo</span>
    </p>
  </div>
</template>

<style scoped>
.resumen-de-lineas {
  position: relative;
  inline-size: 100%;
  max-inline-size: 28rem;
  margin: var(--espacio-2) 0 0;
  border: 1px solid var(--color-borde-foto);
  border-radius: var(--radio);
  background: var(--color-superficie);
  color: var(--color-texto);
  text-align: start;
  overflow: hidden;
}
/* Más de 4 líneas: la tarjeta se desplaza por dentro (la página no) y un degradado abajo avisa
   que hay más; el "y N más" se va al llegar al final. */
.desplazable {
  position: relative;
  padding: var(--espacio-3) var(--espacio-4);
  overflow-y: auto;
  overscroll-behavior: contain;
  /* Hasta que se mide: ~4 líneas. */
  max-block-size: calc(4 * 4.4rem + var(--espacio-3));
}
.desplazable:focus-visible {
  outline: 3px solid var(--color-primario);
  outline-offset: -3px;
}
ul {
  display: grid;
  gap: var(--espacio-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.pista {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--espacio-1);
  margin: 0;
  padding: var(--espacio-1) var(--espacio-3);
  border-block-start: 1px solid var(--color-borde-foto);
  color: var(--color-primario);
  font-weight: 700;
}
/* Degradado sobre el borde de abajo de lo que se ve: la lista sigue más abajo. */
.pista::before {
  content: '';
  position: absolute;
  inset: auto 0 100%;
  block-size: 1.25rem;
  background: linear-gradient(to bottom, transparent, var(--color-superficie));
  pointer-events: none;
}
.pista--final {
  color: var(--color-texto-suave);
  font-weight: 400;
}
.pista--final::before {
  display: none;
}
.icono-pista {
  inline-size: 1.25em;
  block-size: 1.25em;
}
.linea {
  /* Nombre e importe en una fila; si el nombre no entra sin partir una palabra (320 px, letra
     Muy grande), el importe baja a su propia fila. */
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--espacio-3);
}
.linea + .linea {
  padding-block-start: var(--espacio-2);
  border-block-start: 1px solid var(--color-borde-foto);
}
.nombre {
  flex: 1 1 auto;
  min-inline-size: 0;
  font-weight: 700;
}
.importe {
  margin-inline-start: auto;
  font-weight: 700;
  white-space: nowrap;
}
.detalle {
  flex-basis: 100%;
  color: var(--color-texto-suave);
}
</style>
