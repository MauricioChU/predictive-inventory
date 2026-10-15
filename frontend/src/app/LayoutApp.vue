<script setup lang="ts">
import { provide } from 'vue'
import AvisoDeshacer from '@/shared/ui/componentes/AvisoDeshacer.vue'
import BarraNavegacion from '@/shared/ui/componentes/BarraNavegacion.vue'
import { CLAVE_AVISO_DESHACER, crearContextoAvisoDeshacer } from './aviso-deshacer'

const contextoAvisoDeshacer = crearContextoAvisoDeshacer()
provide(CLAVE_AVISO_DESHACER, contextoAvisoDeshacer)

function alDeshacer() {
  contextoAvisoDeshacer.activo.value?.alDeshacer()
  contextoAvisoDeshacer.cerrar()
}
</script>

<template>
  <a href="#contenido" class="saltar-al-contenido">Saltar al contenido</a>

  <!--
    Q2: región aria-live persistente y SIEMPRE presente (nunca se inserta ya llena): mostrar()
    escribe aquí el mensaje una sola vez; el número regresivo visual vive en AvisoDeshacer con
    aria-hidden, para que no se anuncie de nuevo en cada segundo.
  -->
  <p aria-live="polite" role="status" class="solo-lector">
    {{ contextoAvisoDeshacer.anuncio.value }}
  </p>

  <!--
    S1: la navegación es una fila/columna más de esta grilla (no un elemento position:fixed con
    una altura "adivinada"): sea cual sea su alto real (p. ej. si una etiqueta ocupa más que una
    línea en algún idioma/tamaño de letra), la grilla le reserva exactamente ese espacio y
    <main> nunca queda tapado.
  -->
  <div class="layout-app">
    <main id="contenido" class="contenido" tabindex="-1">
      <RouterView />
    </main>
    <div v-if="contextoAvisoDeshacer.activo.value" class="zona-aviso-deshacer">
      <AvisoDeshacer
        :key="contextoAvisoDeshacer.activo.value.id"
        :mensaje="contextoAvisoDeshacer.activo.value.mensaje"
        :segundos="contextoAvisoDeshacer.activo.value.segundos"
        @deshacer="alDeshacer"
        @cerrar="contextoAvisoDeshacer.cerrar"
      />
    </div>
    <BarraNavegacion class="navegacion" />
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

.layout-app {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr auto auto;
  grid-template-areas: 'contenido' 'aviso' 'nav';
  height: 100dvh;
  overflow: hidden;
}

.contenido {
  grid-area: contenido;
  min-width: 0;
  overflow-y: auto;
  width: 100%;
  max-width: var(--ancho-contenido);
  margin-inline: auto;
  padding-inline: var(--espacio-4);
  padding-block: var(--espacio-4);
}
.contenido:focus {
  outline: none;
}

.zona-aviso-deshacer {
  grid-area: aviso;
  padding: var(--espacio-4);
  padding-top: 0;
  max-width: var(--ancho-contenido);
  margin-inline: auto;
  width: 100%;
}

.navegacion {
  grid-area: nav;
  background: var(--color-fondo);
  border-top: 1px solid var(--color-borde);
  padding-bottom: env(safe-area-inset-bottom);
}

@media (min-width: 1024px) {
  .layout-app {
    grid-template-columns: 260px 1fr;
    grid-template-rows: 1fr auto;
    grid-template-areas:
      'nav contenido'
      'nav aviso';
  }
  .navegacion {
    border-top: none;
    border-right: 1px solid var(--color-borde);
    padding: var(--espacio-4);
    overflow-y: auto;
  }
  .contenido {
    max-width: var(--ancho-contenido-pc);
    padding-block: var(--espacio-6);
  }
  .zona-aviso-deshacer {
    max-width: var(--ancho-contenido-pc);
    padding-block: var(--espacio-4);
  }
}
</style>
