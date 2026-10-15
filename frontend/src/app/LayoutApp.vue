<script setup lang="ts">
import { onBeforeUnmount, provide, ref } from 'vue'
import AvisoDeshacer from '@/shared/ui/componentes/AvisoDeshacer.vue'
import BarraNavegacion from '@/shared/ui/componentes/BarraNavegacion.vue'
import { usarAltoComoVariable } from './alto-como-variable'
import { CLAVE_ANUNCIADOR, crearAnunciador } from '@/shared/ui/anunciador'
import {
  CLAVE_AVISO_DESHACER,
  crearContextoAvisoDeshacer,
  SEGUNDOS_PARA_DESHACER,
} from './aviso-deshacer'
import { exponerGanchosDePrueba } from './ganchos-de-prueba'

const anunciador = crearAnunciador()
provide(CLAVE_ANUNCIADOR, anunciador)

const contextoAvisoDeshacer = crearContextoAvisoDeshacer(anunciador)
provide(CLAVE_AVISO_DESHACER, contextoAvisoDeshacer)

function alDeshacer() {
  contextoAvisoDeshacer.activo.value?.alDeshacer()
  contextoAvisoDeshacer.cerrar()
}

// m5: alto real de lo que queda pegado abajo, para scroll-padding-bottom (ver estilos).
const refPie = ref<HTMLElement>()
const refZonaAviso = ref<HTMLElement>()
usarAltoComoVariable(refPie, '--alto-pie')
usarAltoComoVariable(refZonaAviso, '--alto-aviso')

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
  <div class="layout-app">
    <main id="contenido" class="contenido" tabindex="-1">
      <RouterView />
    </main>
    <div ref="refPie" class="pie">
      <div v-if="contextoAvisoDeshacer.activo.value" ref="refZonaAviso" class="zona-aviso-deshacer">
        <AvisoDeshacer
          :key="contextoAvisoDeshacer.activo.value.id"
          :mensaje="contextoAvisoDeshacer.activo.value.mensaje"
          :segundos="SEGUNDOS_PARA_DESHACER"
          @deshacer="alDeshacer"
          @cerrar="contextoAvisoDeshacer.cerrar"
        />
      </div>
      <BarraNavegacion class="navegacion" />
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
   (alto-como-variable.ts), nunca adivinado. En celular es todo el pie (aviso + barra). */
:global(html) {
  scroll-padding-bottom: var(--alto-pie, 0px);
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
.contenido:focus {
  outline: none;
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
  /* En PC lo único pegado abajo es el aviso (la navegación está al costado). */
  :global(html) {
    scroll-padding-bottom: var(--alto-aviso, 0px);
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
