<script setup lang="ts">
import { nextTick, onBeforeUnmount, provide, ref, watch } from 'vue'
import AvisoDeshacer from '@/shared/ui/componentes/AvisoDeshacer.vue'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import BarraNavegacion from '@/shared/ui/componentes/BarraNavegacion.vue'
import { usarAltoObservado } from '@/shared/ui/alto-observado'
import { CLAVE_ANUNCIADOR, crearAnunciador } from '@/shared/ui/anunciador'
import {
  CLAVE_AVISO_DESHACER,
  crearContextoAvisoDeshacer,
  SEGUNDOS_PARA_DESHACER,
} from './aviso-deshacer'
import { exponerGanchosDePrueba } from './ganchos-de-prueba'
import { useEstadoGlobal } from './estado-global'

// RN-AL-06b: el número del botón Control sale del estado global (se refresca con los eventos).
const estadoGlobal = useEstadoGlobal()

const anunciador = crearAnunciador()
provide(CLAVE_ANUNCIADOR, anunciador)

const contextoAvisoDeshacer = crearContextoAvisoDeshacer(anunciador)
provide(CLAVE_AVISO_DESHACER, contextoAvisoDeshacer)

function alDeshacer() {
  contextoAvisoDeshacer.activo.value?.alDeshacer()
  contextoAvisoDeshacer.cerrar()
}

// Plan 12, r1 #2 (RN-UX-11): el botón Deshacer desaparece al tocarlo y el foco quedaría en
// <body>; cuando llega el resultado, el foco pasa a su "Cerrar" (no si la persona ya siguió).
// r2 #3: y si se cierra (solo o con "Cerrar") con el foco adentro, el foco va al título de la
// pantalla, no a <body>.
watch(contextoAvisoDeshacer.resultado, async (resultado, anterior) => {
  if (!resultado && anterior) {
    if (!document.activeElement?.closest('.resultado-de-deshacer')) return
    await nextTick()
    const titulo = document.querySelector<HTMLElement>(
      '#contenido .cambio-de-vista:not(.cambio-de-vista-leave-active) h1',
    )
    if (titulo && !titulo.hasAttribute('tabindex')) titulo.setAttribute('tabindex', '-1')
    titulo?.focus()
    return
  }
  if (!resultado || (document.activeElement && document.activeElement !== document.body)) return
  await nextTick()
  document.querySelector<HTMLElement>('.resultado-de-deshacer .cerrar')?.focus()
})

// Vista que sale: ya no se alcanza (ni con teclado ni con lector) mientras se va.
const animandoVista = ref(false)
// La dirección se fija en cada vista al empezar a entrar o salir: si se navega otra vez a mitad
// de la animación, el atributo de <html> cambia pero lo que ya se mueve no salta.
function fijarLado(el: Element) {
  const lado = getComputedStyle(document.documentElement).getPropertyValue('--vista-lado')
  if (lado) (el as HTMLElement).style.setProperty('--vista-lado', lado)
}
function alEntrarVista(el: Element) {
  animandoVista.value = true
  fijarLado(el)
}
function alSalirVista(el: Element) {
  const vista = el as HTMLElement
  fijarLado(vista)
  // Saldrá del flujo (absolute) y el router llevará la página arriba: se conserva dónde se
  // veía (con la página desplazada) fijando su top, para que se deslice desde ahí y no salte.
  const contenido = document.getElementById('contenido')
  if (contenido) {
    const relativo = vista.getBoundingClientRect().top - contenido.getBoundingClientRect().top
    vista.style.top = `${relativo - window.scrollY}px`
  }
  vista.setAttribute('inert', '')
  vista.setAttribute('aria-hidden', 'true')
}
function alCancelarSalida(el: Element) {
  const vista = el as HTMLElement
  vista.style.removeProperty('top')
  vista.removeAttribute('inert')
  vista.removeAttribute('aria-hidden')
}

// m5: alto real de lo que queda pegado abajo, para scroll-padding-bottom (ver estilos).
const refPie = ref<HTMLElement>()
const refZonaAviso = ref<HTMLElement>()
usarAltoObservado(refPie, { variable: '--alto-pie' })
usarAltoObservado(refZonaAviso, { variable: '--alto-aviso' })

onBeforeUnmount(exponerGanchosDePrueba(contextoAvisoDeshacer))
</script>

<template>
  <a href="#contenido" class="saltar-al-contenido">Saltar al contenido</a>

  <!--
    Región aria-live persistente y SIEMPRE presente (nunca se inserta ya llena). El anunciador
    (ver app/anunciador.ts) une los mensajes que llegan juntos, vuelve a anunciar un mensaje
    repetido y retira solo el mensaje de quien limpia; lo usan el aviso Deshacer y cualquier
    pantalla que lo inyecte (p. ej. PantallaExito).
  -->
  <p aria-live="polite" role="status" class="solo-lector">{{ anunciador.texto.value }}</p>

  <!--
    Scroll normal del documento (ventana), no uno adentro de <main>: un contenedor con su
    propio overflow-y rompe los gestos de borde de Android, evita que la barra de direcciones
    se recoja al bajar, y hace que la posición de scroll guardada por el router nunca se
    aplique. Las columnas usan minmax(0, 1fr), no 1fr a secas: un 1fr sin minmax hereda el
    ancho mínimo de su contenido y ensancha la columna más allá del viewport.

    Celular (< 1024 px): la barra + el aviso Deshacer van en un solo contenedor "pie" al FINAL
    del flujo, con position: sticky abajo — al ser sticky (no fixed) reservan su propio espacio
    según su alto real, así que al final de la página nunca tapan el último elemento. La fila
    de <main> es minmax(0, 1fr) dentro de un min-height: 100dvh: en una pantalla corta crece y
    empuja el pie al fondo real del viewport; en una larga el documento crece y el pie queda
    pegado abajo mientras se desplaza.

    PC (≥ 1024 px), N1 (ronda 4): el pie se vuelve display: contents — la navegación pasa a ser
    la columna izquierda (sticky arriba, a todo el alto) y el aviso Deshacer se queda en la
    COLUMNA DE CONTENIDO, sticky abajo y con el ancho del contenido (antes se dibujaba dentro
    de la barra lateral de 260 px: una letra por línea y los enlaces empujados fuera).
  -->
  <!-- data-app-montada: solo existe si la app arrancó de verdad (las E2E lo esperan). -->
  <!-- RN-UX-16: la primera vez no tiene navegación (no hay a dónde ir); sin ella, en PC el
       contenido ocupa todo el ancho en vez de dejar vacía la columna de 260 px. -->
  <div class="layout-app" :class="{ 'sin-navegacion': estadoGlobal.primeraVez }" data-app-montada>
    <main
      id="contenido"
      class="contenido"
      :class="{ 'animando-vista': animandoVista }"
      tabindex="-1"
    >
      <!-- Cambio de vista: la nueva entra deslizándose desde el lado hacia el que se va (la
           dirección la fija el router en <html data-vista-direccion>; estilos abajo). Se
           anima `left` y no `transform` para que lo fijo (PanelDeCarrito, HojaInferior) siga
           fijo a la pantalla durante la animación. -->
      <RouterView v-slot="{ Component, route }">
        <Transition
          name="cambio-de-vista"
          @before-enter="alEntrarVista"
          @after-enter="animandoVista = false"
          @enter-cancelled="animandoVista = false"
          @before-leave="alSalirVista"
          @leave-cancelled="alCancelarSalida"
        >
          <div v-if="Component" :key="String(route.name ?? route.path)" class="cambio-de-vista">
            <component :is="Component" />
          </div>
        </Transition>
      </RouterView>
    </main>
    <div ref="refPie" class="pie">
      <div
        v-if="contextoAvisoDeshacer.activo.value || contextoAvisoDeshacer.resultado.value"
        ref="refZonaAviso"
        class="zona-aviso-deshacer"
      >
        <AvisoDeshacer
          v-if="contextoAvisoDeshacer.activo.value"
          :key="contextoAvisoDeshacer.activo.value.id"
          :mensaje="contextoAvisoDeshacer.activo.value.mensaje"
          :segundos="SEGUNDOS_PARA_DESHACER"
          @deshacer="alDeshacer"
          @cerrar="contextoAvisoDeshacer.cerrar"
        />
        <!-- Plan 12, r1 #2 (RN-UX-11): en el mismo lugar, qué se deshizo (o por qué no se
             pudo), esté donde esté la persona; una sola vez para toda la app. -->
        <AvisoEnPagina
          v-else-if="contextoAvisoDeshacer.resultado.value"
          :key="contextoAvisoDeshacer.resultado.value.id"
          class="resultado-de-deshacer"
          :tono="contextoAvisoDeshacer.resultado.value.tono"
          :titulo="contextoAvisoDeshacer.resultado.value.titulo"
          :texto="contextoAvisoDeshacer.resultado.value.texto"
          texto-cerrar="Cerrar"
          @cerrar="contextoAvisoDeshacer.cerrarResultado"
        />
      </div>
      <BarraNavegacion
        v-if="!estadoGlobal.primeraVez"
        class="navegacion"
        :contador-control="estadoGlobal.contadorDeAtencion"
      />
    </div>
  </div>
</template>

<style scoped>
.saltar-al-contenido {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 100;
  background: var(--color-fondo);
  color: var(--color-primario);
  font-weight: 700;
  padding: var(--espacio-2) var(--espacio-4);
  border-radius: var(--radio-chico);
}
.saltar-al-contenido:focus {
  left: var(--espacio-2);
  top: var(--espacio-2);
}

/* m5 (WCAG 2.4.11): lo que queda pegado abajo no tapa al elemento que recibe el foco por
   teclado — el navegador desplaza la página dejando libre ese alto, medido en vivo
   (alto-observado.ts), nunca adivinado. En celular es todo el pie (aviso + barra).
   Plan 12: más la BarraDeTotal de Vender/Recibir (pegada justo encima del pie), que publica
   su alto en --alto-barra-de-total mientras está en pantalla (0px si no hay ninguna). */
:global(html) {
  scroll-padding-bottom: calc(var(--alto-pie, 0px) + var(--alto-barra-de-total, 0px));
}

.layout-app {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) auto;
  min-height: 100dvh;
}

.contenido {
  grid-column: 1;
  grid-row: 1;
  min-width: 0;
  width: 100%;
  max-width: var(--ancho-contenido);
  margin-inline: auto;
  padding-inline: var(--espacio-4);
  padding-block: var(--espacio-4);
}
.contenido {
  position: relative;
}
.contenido:focus {
  outline: none;
}
/* RN-UX-09: mientras una vista entra o sale no hay desplazamiento a los lados. `clip` no crea
   contenedor de scroll ni de posición fija. */
.contenido.animando-vista {
  overflow-x: clip;
}

/* Cambio de vista (patrones.md → Movimiento). La dirección: <html data-vista-direccion>.
   --vista-lado: de qué lado llega la vista nueva (+ derecha, - izquierda, 0 solo fundido); la
   que sale se va al lado contrario. */
.cambio-de-vista {
  position: relative;
  left: 0;
}
:global(html[data-vista-direccion='adelante']) {
  --vista-lado: 100%;
}
:global(html[data-vista-direccion='atras']) {
  --vista-lado: -100%;
}
:global(html[data-vista-direccion='fundido']) {
  --vista-lado: 0%;
}
.cambio-de-vista-enter-active {
  animation: vista-entrar var(--duracion-vista) var(--curva-hoja-entrar) both;
}
/* La primera vista (carga de la app) no se anima: aún no hay dirección. */
:global(html:not([data-vista-direccion])) .cambio-de-vista-enter-active {
  animation: none;
}
.cambio-de-vista-leave-active {
  /* Fuera del flujo, en el mismo sitio (top/left/width de la columna con su relleno). */
  position: absolute;
  top: auto;
  width: calc(100% - 2 * var(--espacio-4));
  pointer-events: none;
  animation: vista-salir var(--duracion-vista) var(--curva-hoja-salir) both;
}
@keyframes vista-entrar {
  from {
    left: var(--vista-lado, 0%);
    opacity: 0;
  }
}
@keyframes vista-salir {
  from {
    left: var(--espacio-4);
    opacity: 1;
  }
  to {
    left: calc(var(--espacio-4) - var(--vista-lado, 0%));
    opacity: 0;
  }
}

.pie {
  grid-column: 1;
  grid-row: 2;
  position: sticky;
  bottom: 0;
  z-index: 10;
  background: var(--color-fondo);
}

.zona-aviso-deshacer {
  /* N5: el aviso (con este relleno) nunca pasa del 40 % del alto de la ventana. */
  --aviso-alto-maximo: calc(40dvh - var(--espacio-2) - var(--espacio-3));
  padding: var(--espacio-2) var(--espacio-3) var(--espacio-3);
  max-width: var(--ancho-contenido);
  margin-inline: auto;
  width: 100%;
}

.navegacion {
  border-top: 1px solid var(--color-borde);
  padding-bottom: env(safe-area-inset-bottom);
}

@media (min-width: 1024px) {
  /* En PC lo único pegado abajo es el aviso (la navegación está al costado), y la BarraDeTotal
     si la pantalla tiene una (plan 12). */
  :global(html) {
    scroll-padding-bottom: calc(var(--alto-aviso, 0px) + var(--alto-barra-de-total, 0px));
  }
  .layout-app {
    grid-template-columns: 260px minmax(0, 1fr);
  }
  .contenido {
    grid-column: 2;
    grid-row: 1;
    max-width: var(--ancho-contenido-pc);
    padding-block: var(--espacio-6);
  }
  .pie {
    display: contents;
  }
  .navegacion {
    grid-column: 1;
    grid-row: 1 / -1;
    align-self: start;
    position: sticky;
    top: 0;
    height: 100dvh;
    overflow-y: auto;
    border-top: none;
    border-right: 1px solid var(--color-borde);
    padding: var(--espacio-4);
  }
  .layout-app.sin-navegacion {
    grid-template-columns: minmax(0, 1fr);
  }
  .layout-app.sin-navegacion .contenido,
  .layout-app.sin-navegacion .zona-aviso-deshacer {
    grid-column: 1;
  }
  .zona-aviso-deshacer {
    --aviso-alto-maximo: calc(40dvh - var(--espacio-3) - var(--espacio-4));
    grid-column: 2;
    grid-row: 2;
    position: sticky;
    bottom: 0;
    z-index: 10;
    background: var(--color-fondo);
    max-width: var(--ancho-contenido-pc);
    padding: var(--espacio-3) var(--espacio-4) var(--espacio-4);
  }
}
</style>
