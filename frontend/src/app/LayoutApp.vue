<script setup lang="ts">
import { provide } from 'vue'
import AvisoDeshacer from '@/shared/ui/componentes/AvisoDeshacer.vue'
import BarraNavegacion from '@/shared/ui/componentes/BarraNavegacion.vue'
import { CLAVE_ANUNCIADOR, crearAnunciador } from './anunciador'
import { CLAVE_AVISO_DESHACER, crearContextoAvisoDeshacer } from './aviso-deshacer'

const anunciador = crearAnunciador()
provide(CLAVE_ANUNCIADOR, anunciador)

const contextoAvisoDeshacer = crearContextoAvisoDeshacer(anunciador)
provide(CLAVE_AVISO_DESHACER, contextoAvisoDeshacer)

function alDeshacer() {
  contextoAvisoDeshacer.activo.value?.alDeshacer()
  contextoAvisoDeshacer.cerrar()
}
</script>

<template>
  <a href="#contenido" class="saltar-al-contenido">Saltar al contenido</a>

  <!--
    Región aria-live persistente y SIEMPRE presente (nunca se inserta ya llena). El anunciador
    (ver app/anunciador.ts) resuelve "mismo mensaje dos veces" (lo vacía y lo vuelve a poner) y
    lo usan tanto el aviso Deshacer como cualquier pantalla que lo inyecte (p. ej. PantallaExito).
  -->
  <p aria-live="polite" role="status" class="solo-lector">{{ anunciador.texto.value }}</p>

  <!--
    S1: volvemos al scroll normal del documento (ventana), no uno adentro de <main>: un
    contenedor con su propio overflow-y rompe los gestos de borde de Android, evita que la
    barra de direcciones se recoja al bajar, y hace que la posición de scroll guardada por el
    router nunca se aplique. La barra + el aviso Deshacer van en un solo contenedor "pie" al
    FINAL del flujo normal, con position: sticky (abajo en celular, como columna izquierda y a
    todo el alto desde 1024px): al ser sticky (no fixed) reservan su propio espacio en el
    documento según su alto real — nunca una altura "adivinada" — así que nunca tapan nada.
    Las columnas de la grilla usan minmax(0, 1fr), no 1fr a secas: un 1fr sin minmax hereda el
    tamaño mínimo de su contenido (el ancho mínimo de la barra sin partir palabras) y ensancha
    la columna más allá del viewport.
  -->
  <div class="layout-app">
    <main id="contenido" class="contenido" tabindex="-1">
      <RouterView />
    </main>
    <div class="pie">
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
  grid-template-columns: minmax(0, 1fr);
  min-height: 100dvh;
}

.contenido {
  grid-column: 1;
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
  position: sticky;
  bottom: 0;
  z-index: 10;
  background: var(--color-fondo);
}

.zona-aviso-deshacer {
  padding: var(--espacio-4);
  padding-top: var(--espacio-2);
  max-width: var(--ancho-contenido);
  margin-inline: auto;
  width: 100%;
}

.navegacion {
  border-top: 1px solid var(--color-borde);
  padding-bottom: env(safe-area-inset-bottom);
}

@media (min-width: 1024px) {
  .layout-app {
    grid-template-columns: 260px minmax(0, 1fr);
  }
  .contenido {
    grid-column: 2;
    max-width: var(--ancho-contenido-pc);
    padding-block: var(--espacio-6);
  }
  .pie {
    grid-column: 1;
    position: sticky;
    top: 0;
    bottom: auto;
    height: 100dvh;
    display: flex;
    flex-direction: column;
  }
  .navegacion {
    border-top: none;
    border-right: 1px solid var(--color-borde);
    padding: var(--espacio-4);
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .zona-aviso-deshacer {
    max-width: none;
    padding: var(--espacio-4);
  }
}
</style>
