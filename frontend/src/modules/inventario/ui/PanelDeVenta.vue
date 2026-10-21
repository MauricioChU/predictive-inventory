<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { Check, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { formatearEntero, plural } from '@/shared/domain/formato'
import { usarAltoObservado } from '@/shared/ui/alto-observado'
import { alTerminarAnimacion } from '@/shared/ui/al-terminar-animacion'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import type { CarritoDePantalla } from './carrito-de-pantalla'
import CuandoFue from './CuandoFue.vue'
import type { Cuando, ErrorDeFecha } from './cuando'
import ListaDelCarrito from './ListaDelCarrito.vue'

/**
 * RN-OP-22 — el panel de venta (celular, < 1024 px). Dos estados, siempre con botón (RN-UX-05,
 * nada de deslizar):
 * - abierto (aparece así con el primer producto): una hoja que ocupa toda la pantalla sobre la
 *   navegación, con el título y "Ocultar" arriba; las líneas (con cuánto queda) y ¿Cuándo fue
 *   la venta? seguidas, sin huecos; y el total con Confirmar venta siempre a la vista abajo.
 *   Lo de atrás no se alcanza mientras está abierta (inert en VistaVender);
 * - oculto: pegado abajo en el flujo de la pantalla (reserva su lugar, no tapa la grilla): el
 *   título, el total (con cuántos productos) y Confirmar venta.
 * Al abrir, el foco va al título; al ocultar, vuelve al botón. La asa es solo un dibujo.
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
const refHoja = ref<HTMLElement>()
/** Mientras la hoja baja (animación compartida de base.css), antes de quedar oculta. */
const cerrando = ref(false)
/** RN-OP-11: con un formulario de precio abierto no se confirma: primero guardar o cancelar. */
const bloqueado = computed(() => props.carrito.hayEdicionAbierta.value)

// El foco por teclado nunca queda debajo del panel (WCAG 2.4.11), como con BarraDeTotal.
const altoRaiz = usarAltoObservado(refRaiz, { variable: '--alto-barra-de-total' })
/** Alto del bloque cerrado: abierta, la hoja crece desde ahí y vuelve ahí al ocultarse (y el
 * bloque conserva ese lugar en la página, así nada salta). */
const altoCerrado = ref(0)
watch(altoRaiz, (alto) => {
  if (!props.expandido && alto > 0) altoCerrado.value = alto
})
const estiloRaiz = computed(() => ({
  '--hoja-cerrada-arriba': `calc(100dvh - var(--alto-pie, 0px) - ${altoCerrado.value}px)`,
  ...(props.expandido && altoCerrado.value > 0 ? { minBlockSize: `${altoCerrado.value}px` } : {}),
}))
/** Sin productos: el bloque está, en S/ 0.00, sin "Ver detalle" y sin poder confirmar. */
const vacio = computed(() => props.carrito.vacio.value)
// Abierta, la hoja se desplaza con el título y el pie pegados: lo enfocado queda entre ambos.
usarAltoObservado(refPie, { variable: '--alto-pie-del-panel' })
usarAltoObservado(refCabecera, { variable: '--alto-cabecera-del-panel' })

const cuenta = computed(() => {
  const n = props.carrito.lineas.value.length
  return `${formatearEntero(n)} ${plural(n, 'producto', 'productos')}`
})

async function alternar(): Promise<void> {
  if (cerrando.value) return
  if (!props.expandido) {
    emit('update:expandido', true)
    await nextTick()
    refTitulo.value?.focus()
    return
  }
  await cerrar(true)
}

/** Baja despacio y recién después queda oculta (también al quitar el último producto). */
async function cerrar(enfocarBoton: boolean): Promise<void> {
  if (cerrando.value || !props.expandido) return
  cerrando.value = true
  await nextTick()
  alTerminarAnimacion(refHoja.value, () => {
    cerrando.value = false
    emit('update:expandido', false)
    if (enfocarBoton) void nextTick(() => refAlternar.value?.focus())
  })
}

watch(vacio, (sinProductos) => {
  if (sinProductos) void cerrar(false)
})

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
    :style="estiloRaiz"
    :aria-labelledby="idTitulo"
    @keydown.esc="ocultarConEscape"
  >
    <!-- Tocar fuera de la hoja también la oculta (comodidad: el botón siempre está). -->
    <div
      v-if="expandido"
      class="velo"
      :class="cerrando ? 'velo-sale' : 'velo-entra'"
      aria-hidden="true"
      @click="alternar"
    />
    <div
      ref="refHoja"
      class="hoja"
      :class="{ 'hoja-entra': expandido && !cerrando, 'hoja-sale': cerrando }"
    >
      <div ref="refCabecera" class="cabecera-del-panel">
        <!-- Tocar la asa también abre y oculta (comodidad: el botón es lo que lee el lector). -->
        <div class="asa" aria-hidden="true" @click="vacio ? undefined : alternar()" />
        <!-- Tocar el título también abre y oculta (comodidad: el botón es lo que lee el lector). -->
        <h2
          :id="idTitulo"
          ref="refTitulo"
          class="titulo-carrito"
          tabindex="-1"
          @click="vacio ? undefined : alternar()"
        >
          En esta venta
        </h2>
        <button
          v-if="!vacio"
          ref="refAlternar"
          type="button"
          class="alternar"
          :aria-expanded="expandido ? 'true' : 'false'"
          :aria-controls="expandido ? idDetalle : undefined"
          :aria-label="expandido ? 'Ocultar' : undefined"
          :class="{ 'alternar--solo-icono': expandido }"
          @click="alternar"
        >
          <span v-if="!expandido">Ver detalle</span>
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
        <p v-if="bloqueado" class="aviso-bloqueo" role="status">
          Guarda o cancela el precio para confirmar.
        </p>
        <BotonPrincipal
          class="confirmar"
          texto="Confirmar venta"
          :icono="Check"
          :deshabilitado="registrando || bloqueado || vacio"
          @click="emit('confirmar')"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Oculto: pegado sobre el pie global (navegación + aviso Deshacer), de borde a borde del
   contenido (cubre el relleno de <main>). Va en el flujo: reserva su lugar y no tapa la grilla. */
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
  cursor: pointer;
  /* Zona de toque más alta que la raya que se ve. */
  box-sizing: content-box;
  background-clip: content-box;
  padding-block: var(--espacio-2);
  margin-block: calc(-1 * var(--espacio-2)) calc(var(--espacio-1) - var(--espacio-2));
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
.alternar--solo-icono {
  justify-content: center;
  min-inline-size: var(--alto-toque);
}
.icono {
  inline-size: 1.25em;
  block-size: 1.25em;
  flex: none;
}
/* Las líneas y la fecha, seguidas: sin huecos entre ellas. */
.detalle {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: var(--espacio-3);
  /* Aire para el anillo de foco de los campos que tocan el borde. */
  padding: 0 4px var(--espacio-3);
  margin: 0 -4px;
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
.panel-de-venta:not(.panel-de-venta--abierto) .pie-del-panel {
  gap: var(--espacio-1);
  padding-block-start: 0;
}
.total-del-panel {
  display: flex;
  /* 320 px con letra Muy grande: el monto baja a su renglón antes que desbordar. */
  flex-wrap: wrap;
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
.cuenta {
  font-weight: 400;
  white-space: nowrap;
}
.total {
  /* Un monto nunca se parte. */
  font-size: 1.6rem;
  font-weight: 700;
  white-space: nowrap;
}

/* Abierta: toda la pantalla sobre la navegación (con un borde arriba para que se vea la hoja).
   La hoja entera se desplaza; el título y el pie quedan pegados arriba y abajo. */
.panel-de-venta--abierto .hoja {
  position: fixed;
  inset-inline: 0;
  inset-block: var(--espacio-3) var(--alto-pie, 0px);
  z-index: 8;
  box-sizing: border-box;
  inline-size: 100%;
  padding-block: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-padding-block-start: var(--alto-cabecera-del-panel, 4.5rem);
  scroll-padding-block-end: var(--alto-pie-del-panel, 8rem);
}
.panel-de-venta--abierto .cabecera-del-panel {
  position: sticky;
  inset-block-start: 0;
  z-index: 1;
  margin-inline: calc(-1 * var(--espacio-4));
  padding: var(--espacio-2) var(--espacio-4) var(--espacio-2);
  background: var(--color-superficie);
}
/* Con pocas líneas, el pie baja hasta abajo (el espacio libre queda debajo de la fecha). */
.panel-de-venta--abierto .avisos-del-panel {
  margin-block-start: auto;
}
.panel-de-venta--abierto .detalle + .pie-del-panel {
  margin-block-start: auto;
}
.panel-de-venta--abierto .pie-del-panel {
  position: sticky;
  inset-block-end: 0;
  margin-inline: calc(-1 * var(--espacio-4));
  padding: var(--espacio-2) var(--espacio-4) var(--espacio-3);
  background: var(--color-superficie);
}
.velo {
  position: fixed;
  inset: 0 0 var(--alto-pie, 0px) 0;
  z-index: 7;
  background: rgb(18 26 24 / 0.45);
}
/* Pantalla baja (celular en horizontal): no queda lugar para un título y un pie fijos; todo se
   desplaza junto, con Confirmar venta al final. */
@media (max-height: 520px) {
  .asa {
    display: none;
  }
  /* Oculto: dos filas, para dejarle lugar a la grilla: título y Ver detalle; total y
     Confirmar venta lado a lado. */
  .panel-de-venta:not(.panel-de-venta--abierto) .pie-del-panel {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    align-items: center;
    gap: var(--espacio-3);
  }
  .panel-de-venta:not(.panel-de-venta--abierto) .total-del-panel {
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
  }
  .panel-de-venta--abierto .cabecera-del-panel,
  .panel-de-venta--abierto .pie-del-panel {
    position: static;
  }
  .panel-de-venta--abierto .hoja {
    scroll-padding-block: 0;
  }
}
.aviso-bloqueo {
  margin: 0;
  color: var(--color-advertencia);
  font-weight: 700;
}
</style>
