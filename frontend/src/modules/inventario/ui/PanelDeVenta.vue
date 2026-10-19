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
const refPie = ref<HTMLElement>()
const refCabecera = ref<HTMLElement>()
/** El alto del panel compacto: se reserva mientras la hoja abierta flota sobre la pantalla. */
const reserva = ref(0)

// El foco por teclado nunca queda debajo del panel (WCAG 2.4.11), como con BarraDeTotal.
usarAltoObservado(refRaiz, { variable: '--alto-barra-de-total' })
// Abierta, la hoja se desplaza y el total con Confirmar venta queda pegado abajo: lo enfocado
// se desplaza por encima de ese pie (scroll-padding), nunca debajo.
usarAltoObservado(refPie, { variable: '--alto-pie-del-panel' })
usarAltoObservado(refCabecera, { variable: '--alto-cabecera-del-panel' })

/** "1 producto" / "3 productos": va aparte del título para que, abierta la hoja junto a
 * "Cerrar", baje entera a su renglón en vez de partirse a la mitad. */
const cuenta = computed(() => {
  const n = props.carrito.lineas.value.length
  return `${formatearEntero(n)} ${plural(n, 'producto', 'productos')}`
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
      <div ref="refCabecera" class="cabecera-del-panel">
        <div class="asa" aria-hidden="true" />
        <!-- Tocar el título también abre y cierra (comodidad: el botón es lo que lee el lector). -->
        <!-- Se lee "En esta venta · 3 productos" (el separador queda para el lector cuando la
             cuenta baja a su renglón). -->
        <h2 :id="idTitulo" ref="refTitulo" class="titulo-carrito" tabindex="-1" @click="alternar">
          En esta venta<span class="cuenta"><span class="separador"> · </span>{{ cuenta }}</span>
        </h2>
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
        <ListaDelCarrito :carrito="carrito" concepto="venta" texto-vacio="" compacta />
        <CuandoFue
          :model-value="cuando"
          pregunta="¿Cuándo fue la venta?"
          :error="errorFecha"
          @update:model-value="emit('update:cuando', $event)"
        />
      </div>

      <div v-if="$slots.avisos" class="avisos-del-panel"><slot name="avisos" /></div>

      <div ref="refPie" class="pie-del-panel">
        <p class="total-del-panel">
          <span class="etiqueta">Total</span>
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
/* Compacto: pegado sobre el pie global (navegación + aviso Deshacer), de borde a borde del
   contenido (cubre el relleno de <main>). Reserva su propio lugar: no tapa lo de arriba. */
.panel-de-venta {
  position: sticky;
  bottom: var(--alto-pie, 0px);
  z-index: 5;
  margin: var(--espacio-4) calc(-1 * var(--espacio-4)) calc(-1 * var(--espacio-4));
}
/* La hoja es una cuadrícula: compacto = título · total y "Ver detalle" · Confirmar venta. */
.hoja {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'asa asa'
    'titulo titulo'
    'total alternar'
    'avisos avisos'
    'confirmar confirmar';
  align-items: center;
  gap: 0 var(--espacio-3);
  max-inline-size: var(--ancho-contenido);
  margin-inline: auto;
  padding: var(--espacio-2) var(--espacio-4) var(--espacio-3);
  border: 1px solid var(--color-borde-foto);
  border-block-end: none;
  border-radius: 22px 22px 0 0;
  background: var(--color-superficie);
  box-shadow: var(--sombra-flotante);
}
/* Compacto: asa, título y botón son celdas de la hoja (la cabecera no dibuja caja). */
.cabecera-del-panel {
  display: contents;
}
.asa {
  grid-area: asa;
  justify-self: center;
  inline-size: 2.5rem;
  block-size: 4px;
  margin-block-end: var(--espacio-2);
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
  white-space: nowrap;
}
/* Abierta, "Cerrar" va al lado: la cuenta baja a su propio renglón, más chica. El separador
   " · " queda solo para el lector (sigue diciendo "En esta venta · 3 productos"). */
.panel-de-venta--abierto .cuenta {
  display: block;
  color: var(--color-texto-suave);
  font-size: 0.95rem;
}
.panel-de-venta--abierto .separador {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
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
.detalle {
  grid-area: detalle;
  align-self: stretch;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-4);
  /* Aire para el anillo de foco de los campos que tocan el borde de la hoja. */
  padding: 4px;
  margin: 0 -4px var(--espacio-3);
}
.avisos-del-panel {
  grid-area: avisos;
  min-inline-size: 0;
  margin-block-end: var(--espacio-2);
}
/* Compacto: el total y Confirmar venta son celdas de la hoja (el pie no dibuja caja); "Total"
   va arriba del monto, para dejarle lugar a "Ver detalle" al lado. */
.pie-del-panel {
  display: contents;
}
.total-del-panel {
  grid-area: total;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin: 0;
  line-height: 1.1;
}
.etiqueta {
  color: var(--color-texto-suave);
  font-weight: 700;
  white-space: nowrap;
}
.total {
  /* Un monto nunca se parte. */
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.15;
  white-space: nowrap;
}
.confirmar {
  grid-area: confirmar;
}

/* Pantalla baja (celular en horizontal): el compacto se achata a dos filas — título y Ver detalle,
   total y Confirmar venta — para dejarle lugar a la grilla. */
@media (max-height: 520px) {
  .panel-de-venta:not(.panel-de-venta--abierto) .hoja {
    grid-template-areas:
      'titulo alternar'
      'avisos avisos'
      'total confirmar';
  }
  .panel-de-venta:not(.panel-de-venta--abierto) .asa {
    display: none;
  }
}

/* Expandido: la hoja cubre la pantalla salvo un margen arriba y deja la navegación a la vista.
   El panel conserva su lugar en la página (min-block-size en línea), así nada salta al abrir.
   Título y "Cerrar" arriba, las líneas se desplazan en medio, y el total y Confirmar venta quedan
   siempre a la vista abajo. */
.panel-de-venta--abierto .hoja {
  position: fixed;
  inset-inline: 0;
  inset-block-end: var(--alto-pie, 0px);
  z-index: 8;
  box-sizing: border-box;
  inline-size: 100%;
  block-size: calc(100dvh - var(--alto-pie, 0px) - var(--espacio-5));
  /* La hoja entera se desplaza (también en celular horizontal o con letra Muy grande, donde las
     líneas no entran); el total y Confirmar venta quedan pegados abajo, siempre a la vista. */
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-padding-block-start: var(--alto-cabecera-del-panel, 4.5rem);
  scroll-padding-block-end: var(--alto-pie-del-panel, 8rem);
  padding-block: 0;
  grid-template-areas:
    'cabecera'
    'detalle'
    'avisos'
    'pie';
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto 1fr auto auto;
  animation: abrir-hoja 0.18s ease-out;
}
.panel-de-venta--abierto .cabecera-del-panel {
  grid-area: cabecera;
  position: sticky;
  inset-block-start: 0;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'asa asa'
    'titulo alternar';
  align-items: center;
  gap: 0 var(--espacio-3);
  margin-inline: calc(-1 * var(--espacio-4));
  padding: var(--espacio-2) var(--espacio-4) 0;
  background: var(--color-superficie);
}
.panel-de-venta--abierto .total-del-panel,
.panel-de-venta--abierto .confirmar {
  grid-area: auto;
}
.panel-de-venta--abierto .pie-del-panel {
  grid-area: pie;
  position: sticky;
  inset-block-end: 0;
  display: grid;
  gap: var(--espacio-1);
  margin-inline: calc(-1 * var(--espacio-4));
  padding: var(--espacio-2) var(--espacio-4) var(--espacio-3);
  border-block-start: 1px solid var(--color-borde-foto);
  background: var(--color-superficie);
}
.panel-de-venta--abierto .total-del-panel {
  flex-direction: row;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--espacio-3);
}
.velo {
  position: fixed;
  inset: 0 0 var(--alto-pie, 0px) 0;
  z-index: 7;
  background: rgb(18 26 24 / 0.45);
}
/* Pantalla baja (celular en horizontal): no queda lugar para un título y un pie fijos; todo
   se desplaza junto, con Confirmar venta al final. */
@media (max-height: 520px) {
  .panel-de-venta--abierto .cabecera-del-panel,
  .panel-de-venta--abierto .pie-del-panel {
    position: static;
  }
  .panel-de-venta--abierto .hoja {
    scroll-padding-block: 0;
  }
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
