<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, type Ref } from 'vue'
import { Check, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { formatearEntero, plural } from '@/shared/domain/formato'
import { usarAltoObservado } from '@/shared/ui/alto-observado'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import type { CarritoDePantalla } from './carrito-de-pantalla'
import CuandoFue from './CuandoFue.vue'
import type { Cuando, ErrorDeFecha } from './cuando'
import ListaDelCarrito from './ListaDelCarrito.vue'

function usarPantallaBaja(): Ref<boolean> {
  const baja = ref(false)
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return baja
  const consulta = window.matchMedia('(max-height: 520px)')
  baja.value = consulta.matches
  const alCambiar = (evento: { matches: boolean }): void => {
    baja.value = evento.matches
  }
  consulta.addEventListener('change', alCambiar)
  onBeforeUnmount(() => consulta.removeEventListener('change', alCambiar))
  return baja
}

/**
 * RN-OP-22 — el panel de venta (celular, < 1024 px): una hoja pegada abajo, sobre la
 * navegación, que aparece ya abierta al agregar el primer producto. Siempre en el flujo de la
 * pantalla (sticky): reserva su lugar, así la grilla de arriba se sigue viendo y tocando para
 * agregar más. Dos estados, siempre con botón (RN-UX-05, nada de deslizar):
 * - abierto (por defecto): las líneas (con cuánto queda de cada una) y ¿Cuándo fue la venta?;
 *   mide lo que ocupa su contenido (sin huecos) y, con muchas, las líneas se desplazan dentro;
 * - oculto: solo el título, el total (con cuántos productos) y Confirmar venta.
 * El total y Confirmar venta quedan siempre a la vista abajo. Al abrir u ocultar con el botón,
 * el foco va al título o vuelve al botón. La asa de arriba es solo un dibujo.
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
const refPie = ref<HTMLElement>()

/** Pantalla baja (celular en horizontal): el panel va en el flujo, no pegado abajo (ver CSS). */
const pantallaBaja = usarPantallaBaja()
// El foco por teclado nunca queda debajo del panel (WCAG 2.4.11), como con BarraDeTotal. Si no
// está pegado abajo, no tapa nada: no reserva lugar.
usarAltoObservado(
  computed(() => (pantallaBaja.value ? undefined : refRaiz.value)),
  { variable: '--alto-barra-de-total' },
)
// Dentro de la hoja, lo enfocado se desplaza por encima del pie (total y Confirmar venta).
usarAltoObservado(refPie, { variable: '--alto-pie-del-panel' })

const cuenta = computed(() => {
  const n = props.carrito.lineas.value.length
  return `${formatearEntero(n)} ${plural(n, 'producto', 'productos')}`
})

async function alternar(): Promise<void> {
  const abrir = !props.expandido
  emit('update:expandido', abrir)
  await nextTick()
  ;(abrir ? refTitulo.value : refAlternar.value)?.focus()
}

/** Escape oculta el detalle (además de su botón). */
function ocultarConEscape(): void {
  if (props.expandido) void alternar()
}
</script>

<template>
  <section
    ref="refRaiz"
    class="panel-de-venta"
    :class="{ 'panel-de-venta--abierto': expandido }"
    :aria-labelledby="idTitulo"
    @keydown.esc="ocultarConEscape"
  >
    <div class="hoja">
      <div class="cabecera-del-panel">
        <div class="asa" aria-hidden="true" />
        <!-- Tocar el título también abre y oculta (comodidad: el botón es lo que lee el lector). -->
        <h2 :id="idTitulo" ref="refTitulo" class="titulo-carrito" tabindex="-1" @click="alternar">
          En esta venta
        </h2>
        <button
          ref="refAlternar"
          type="button"
          class="alternar"
          :aria-expanded="expandido ? 'true' : 'false'"
          :aria-controls="expandido ? idDetalle : undefined"
          @click="alternar"
        >
          <span>{{ expandido ? 'Ocultar' : 'Ver detalle' }}</span>
          <component :is="expandido ? ChevronDown : ChevronUp" aria-hidden="true" class="icono" />
        </button>
      </div>

      <div v-if="expandido" :id="idDetalle" class="detalle">
        <ListaDelCarrito :carrito="carrito" concepto="venta" texto-vacio="" compacta />
        <CuandoFue
          class="cuando-del-panel"
          :model-value="cuando"
          pregunta="¿Cuándo fue la venta?"
          :error="errorFecha"
          @update:model-value="emit('update:cuando', $event)"
        />
      </div>

      <div v-if="$slots.avisos" class="avisos-del-panel"><slot name="avisos" /></div>

      <div ref="refPie" class="pie-del-panel">
        <p class="total-del-panel">
          <span class="etiqueta"
            >Total <span class="cuenta">· {{ cuenta }}</span></span
          >
          <span class="total">{{ textoTotal }}</span>
        </p>
        <BotonPrincipal
          class="confirmar"
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
/* Pegado sobre el pie global (navegación + aviso Deshacer), de borde a borde del contenido
   (cubre el relleno de <main>). Va en el flujo: reserva su lugar y no tapa lo de arriba. */
.panel-de-venta {
  position: sticky;
  bottom: var(--alto-pie, 0px);
  z-index: 5;
  margin: var(--espacio-4) calc(-1 * var(--espacio-4)) calc(-1 * var(--espacio-4));
}
.hoja {
  display: flex;
  flex-direction: column;
  max-inline-size: var(--ancho-contenido);
  /* Abierta, mide lo que ocupa su contenido, sin huecos; con muchas líneas llega casi arriba
     (deja ver el borde de la grilla) y las líneas se desplazan dentro. */
  max-block-size: calc(100dvh - var(--alto-pie, 0px) - 4.5rem);
  margin-inline: auto;
  padding: var(--espacio-2) var(--espacio-4) var(--espacio-3);
  border: 1px solid var(--color-borde-foto);
  border-block-end: none;
  border-radius: 22px 22px 0 0;
  background: var(--color-superficie);
  box-shadow: var(--sombra-flotante);
}
.cabecera-del-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'asa asa'
    'titulo alternar';
  align-items: center;
  gap: 0 var(--espacio-3);
  flex: none;
}
.asa {
  grid-area: asa;
  justify-self: center;
  inline-size: 2.5rem;
  block-size: 4px;
  margin-block-end: var(--espacio-1);
  border-radius: 999px;
  background: var(--color-borde);
  opacity: 0.55;
}
.titulo-carrito {
  grid-area: titulo;
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.25;
  overflow-wrap: break-word;
  cursor: pointer;
}
.titulo-carrito:focus {
  outline: none;
}
.cuenta {
  font-weight: 400;
  white-space: nowrap;
}
.alternar {
  grid-area: alternar;
  display: inline-flex;
  align-items: center;
  gap: var(--espacio-1);
  min-block-size: var(--alto-toque);
  padding: 0 var(--espacio-2);
  margin-inline-end: calc(-1 * var(--espacio-2));
  border: none;
  border-radius: var(--radio-chico);
  background: none;
  color: var(--color-primario);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.icono {
  inline-size: 1.25em;
  block-size: 1.25em;
  flex: none;
}
/* Las líneas y la fecha: lo único que se desplaza; el título y el pie quedan fijos. */
.detalle {
  /* Contenedor de lo posicionado adentro (los textos solo para el lector): si no, quedan fuera
     del recorte del desplazamiento y alargan la página (hueco blanco bajo la navegación). */
  position: relative;
  flex: 0 1 auto;
  min-block-size: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-padding-block: var(--espacio-3);
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-3);
  /* Aire para el anillo de foco de los campos que tocan el borde. */
  padding: 0 4px var(--espacio-3);
  margin: 0 -4px;
  border-block-end: 1px solid var(--color-borde-foto);
}
.cuando-del-panel {
  gap: var(--espacio-2);
}
.avisos-del-panel {
  flex: none;
  min-inline-size: 0;
  margin-block-start: var(--espacio-2);
}
.pie-del-panel {
  flex: none;
  display: grid;
  gap: var(--espacio-2);
  padding-block-start: var(--espacio-2);
}
.total-del-panel {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--espacio-3);
  margin: 0;
  line-height: 1.15;
}
.etiqueta {
  color: var(--color-texto-suave);
  font-weight: 700;
}
.total {
  /* Un monto nunca se parte. */
  font-size: 1.6rem;
  font-weight: 700;
  white-space: nowrap;
}

/* Oculto: lo mínimo, para dejarle lugar a la grilla. */
.panel-de-venta:not(.panel-de-venta--abierto) .pie-del-panel {
  gap: var(--espacio-1);
  padding-block-start: 0;
}
/* Pantalla baja (celular en horizontal): una hoja pegada abajo taparía casi todo (la grilla y
   las líneas quedarían fuera de la vista al recibir el foco). Va en el flujo, al final de la
   página, sin alto máximo: todo se alcanza desplazando la página. */
@media (max-height: 520px) {
  .panel-de-venta {
    position: static;
  }
  .hoja {
    max-block-size: none;
  }
  .detalle {
    overflow: visible;
  }
  .asa {
    display: none;
  }
}
.panel-de-venta--abierto .hoja {
  animation: abrir-hoja 0.18s ease-out;
}
@keyframes abrir-hoja {
  from {
    transform: translateY(1rem);
    opacity: 0.7;
  }
  to {
    transform: none;
    opacity: 1;
  }
}
</style>
