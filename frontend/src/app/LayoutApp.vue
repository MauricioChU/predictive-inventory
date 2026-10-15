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
  <div class="layout-app">
    <BarraNavegacion class="navegacion" />
    <main id="contenido" class="contenido" tabindex="-1">
      <RouterView />
    </main>
  </div>
  <div v-if="contextoAvisoDeshacer.activo.value" class="zona-aviso-deshacer">
    <AvisoDeshacer
      :mensaje="contextoAvisoDeshacer.activo.value.mensaje"
      :segundos="contextoAvisoDeshacer.activo.value.segundos"
      @deshacer="alDeshacer"
      @cerrar="contextoAvisoDeshacer.cerrar"
    />
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
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

.navegacion {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 10;
  background: var(--color-fondo);
  border-top: 1px solid var(--color-borde);
  padding-bottom: env(safe-area-inset-bottom);
}

.contenido {
  flex: 1;
  width: 100%;
  max-width: var(--ancho-contenido);
  margin-inline: auto;
  padding-inline: var(--espacio-4);
  padding-block-start: var(--espacio-4);
  padding-block-end: calc(var(--alto-toque) + var(--espacio-6) + env(safe-area-inset-bottom));
}
.contenido:focus {
  outline: none;
}

.zona-aviso-deshacer {
  position: fixed;
  left: var(--espacio-4);
  right: var(--espacio-4);
  bottom: calc(var(--alto-toque) + var(--espacio-4) + env(safe-area-inset-bottom));
  z-index: 20;
}

@media (min-width: 1024px) {
  .layout-app {
    flex-direction: row;
  }
  .navegacion {
    position: sticky;
    top: 0;
    inset-inline: auto;
    bottom: auto;
    left: 0;
    width: 260px;
    flex: none;
    height: 100dvh;
    border-top: none;
    border-right: 1px solid var(--color-borde);
    padding: var(--espacio-4);
    padding-bottom: var(--espacio-4);
  }
  .contenido {
    max-width: var(--ancho-contenido-pc);
    padding-block-end: var(--espacio-6);
  }
  .zona-aviso-deshacer {
    left: 280px;
    right: var(--espacio-4);
    bottom: var(--espacio-4);
    max-width: var(--ancho-contenido-pc);
    margin-inline: auto;
  }
}
</style>
