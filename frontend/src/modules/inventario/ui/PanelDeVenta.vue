<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { Check, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { formatearEntero, plural } from '@/shared/domain/formato'
import { usarAltoObservado } from '@/shared/ui/alto-observado'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import type { CarritoDePantalla } from './carrito-de-pantalla'
import CuandoFue from './CuandoFue.vue'
import type { Cuando, ErrorDeFecha } from './cuando'
import ListaDelCarrito from './ListaDelCarrito.vue'

/**
 * RN-OP-22 — el panel de venta (celular, < 1024 px): una hoja que sube desde abajo al agregar el
 * primer producto. Dos estados, siempre con botón (RN-UX-05, nada de deslizar):
 * - compacto: "En esta venta · N productos", el total y Confirmar venta; va en el flujo de la
 *   pantalla (sticky, justo sobre el pie), así reserva su lugar y no tapa la grilla;
 * - expandido: cubre la pantalla salvo un margen y suma las líneas (con cuánto queda de cada
 *   una) y ¿Cuándo fue la venta?; el total y Confirmar venta quedan siempre a la vista abajo.
 * Al abrir, el foco va al título; al cerrar, vuelve al botón que lo abrió. La asa de arriba es
 * solo un dibujo de la forma de la hoja.
 */
const props = defineProps<{
  carrito: CarritoDePantalla
  cuando: Cuando
  errorFecha?: ErrorDeFecha
  textoTotal: string
  registrando: boolean
  expandido: boolean
}>()
const emit = defineEmits<{
  'update:cuando': [valor: Cuando]
  'update:expandido': [valor: boolean]
  confirmar: []
}>()

const idTitulo = useId()
const idDetalle = useId()
const refRaiz = ref<HTMLElement>()
const refTitulo = ref<HTMLElement>()
const refAlternar = ref<HTMLElement>()
/** El alto del panel compacto: se reserva mientras la hoja abierta flota sobre la pantalla. */
const reserva = ref(0)

// El foco por teclado nunca queda debajo del panel (WCAG 2.4.11), como con BarraDeTotal.
usarAltoObservado(refRaiz, { variable: '--alto-barra-de-total' })

const titulo = computed(() => {
  const n = props.carrito.lineas.value.length
  return `En esta venta · ${formatearEntero(n)} ${plural(n, 'producto', 'productos')}`
})

async function alternar(): Promise<void> {
  const abrir = !props.expandido
  if (abrir) reserva.value = refRaiz.value?.offsetHeight ?? 0
  emit('update:expandido', abrir)
  await nextTick()
  ;(abrir ? refTitulo.value : refAlternar.value)?.focus()
}

/** Escape cierra la hoja abierta (además de su botón). */
function cerrarConEscape(): void {
  if (props.expandido) void alternar()
}
</script>

<template>
  <section
    ref="refRaiz"
    class="panel-de-venta"
    :class="{ 'panel-de-venta--abierto': expandido }"
    :style="expandido ? { minBlockSize: `${reserva}px` } : undefined"
    :aria-labelledby="idTitulo"
    @keydown.esc="cerrarConEscape"
  >
    <!-- Tocar fuera de la hoja también la cierra (comodidad: el botón Cerrar siempre está). -->
    <div v-if="expandido" class="velo" aria-hidden="true" @click="alternar" />
    <div class="hoja">
      <div class="asa" aria-hidden="true" />
      <div class="cabecera">
        <h2 :id="idTitulo" ref="refTitulo" class="titulo-carrito" tabindex="-1">{{ titulo }}</h2>
        <button
          ref="refAlternar"
          type="button"
          class="alternar"
          :aria-expanded="expandido ? 'true' : 'false'"
          :aria-controls="expandido ? idDetalle : undefined"
          @click="alternar"
        >
          <span>{{ expandido ? 'Cerrar' : 'Ver detalle' }}</span>
          <component :is="expandido ? ChevronDown : ChevronUp" aria-hidden="true" class="icono" />
        </button>
      </div>

      <div v-if="expandido" :id="idDetalle" class="detalle">
        <ListaDelCarrito :carrito="carrito" concepto="venta" texto-vacio="" />
        <CuandoFue
          :model-value="cuando"
          pregunta="¿Cuándo fue la venta?"
          :error="errorFecha"
          @update:model-value="emit('update:cuando', $event)"
        />
      </div>

      <div v-if="$slots.avisos" class="avisos-del-panel"><slot name="avisos" /></div>

      <div class="pie-del-panel">
        <p class="total-del-panel">
          <span class="etiqueta">Total</span>
          <span class="total">{{ textoTotal }}</span>
        </p>
        <BotonPrincipal
          texto="Confirmar venta"
          :icono="Check"
          :deshabilitado="registrando"
          @click="emit('confirmar')"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Compacto: pegado sobre el pie global (navegación + aviso Deshacer), de borde a borde del
   contenido (cubre el relleno de <main>). Reserva su propio lugar: no tapa lo de arriba. */
.panel-de-venta {
  position: sticky;
  bottom: var(--alto-pie, 0px);
  z-index: 5;
  margin: var(--espacio-4) calc(-1 * var(--espacio-4)) calc(-1 * var(--espacio-4));
}
.hoja {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-1);
  max-inline-size: var(--ancho-contenido);
  margin-inline: auto;
  padding: var(--espacio-2) var(--espacio-4) var(--espacio-3);
  border: 1px solid var(--color-borde-foto);
  border-block-end: none;
  border-radius: 22px 22px 0 0;
  background: var(--color-superficie);
  box-shadow: var(--sombra-flotante);
}
.asa {
  align-self: center;
  inline-size: 2.5rem;
  block-size: 4px;
  border-radius: 999px;
  background: var(--color-borde);
  opacity: 0.55;
}
.cabecera {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--espacio-3);
  min-block-size: var(--alto-toque);
}
.titulo-carrito {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.25;
}
.titulo-carrito:focus {
  outline: none;
}
.alternar {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--espacio-1);
  min-block-size: var(--alto-toque);
  padding: 0 var(--espacio-2);
  border: none;
  border-radius: var(--radio-chico);
  background: none;
  color: var(--color-primario);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
/* Toda la cabecera es el botón: se abre y se cierra tocándola en cualquier parte. */
.alternar::after {
  content: '';
  position: absolute;
  inset: 0;
}
.alternar:focus-visible {
  outline: none;
}
.alternar:focus-visible::after {
  outline: 3px solid var(--color-foco);
  outline-offset: -3px;
  border-radius: var(--radio-chico);
}
.icono {
  inline-size: 1.25em;
  block-size: 1.25em;
  flex: none;
}
.detalle {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-4);
  min-block-size: 0;
  overflow-y: auto;
  /* Aire para el anillo de foco de los campos que tocan el borde de la zona que se desplaza. */
  padding: 4px;
  margin: -4px;
  overscroll-behavior: contain;
}
.avisos-del-panel {
  min-inline-size: 0;
}
.pie-del-panel {
  display: grid;
  gap: var(--espacio-1);
}
.total-del-panel {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--espacio-3);
  margin: 0;
}
.etiqueta {
  color: var(--color-texto-suave);
  font-weight: 700;
}
.total {
  /* Un monto nunca se parte. */
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.15;
  white-space: nowrap;
}

/* Expandido: la hoja cubre la pantalla salvo un margen arriba y deja la navegación a la vista.
   El panel conserva su lugar en la página (min-block-size en línea), así nada salta al abrir. */
.panel-de-venta--abierto .hoja {
  position: fixed;
  inset-inline: 0;
  inset-block-end: var(--alto-pie, 0px);
  z-index: 8;
  box-sizing: border-box;
  inline-size: 100%;
  max-block-size: calc(100dvh - var(--alto-pie, 0px) - var(--espacio-5));
  animation: abrir-hoja 0.18s ease-out;
}
.velo {
  position: fixed;
  inset: 0 0 var(--alto-pie, 0px) 0;
  z-index: 7;
  background: rgb(18 26 24 / 0.45);
}
.panel-de-venta--abierto .pie-del-panel {
  padding-block-start: var(--espacio-2);
  border-block-start: 1px solid var(--color-borde-foto);
}
@keyframes abrir-hoja {
  from {
    transform: translateY(1.5rem);
    opacity: 0.6;
  }
  to {
    transform: none;
    opacity: 1;
  }
}
</style>
