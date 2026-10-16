<script setup lang="ts">
import type { Component } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { ChevronRight } from 'lucide-vue-next'
import { pegarCifras } from '@/shared/ui/texto-sin-cortes'

/** Una fila de Ajustes que abre otra pantalla: ícono, nombre, un detalle y la flecha. */
withDefaults(
  defineProps<{ a: RouteLocationRaw; titulo: string; detalle?: string; icono: Component }>(),
  { detalle: undefined },
)
</script>

<template>
  <RouterLink :to="a" class="enlace-de-ajuste">
    <span class="contenido">
      <component :is="icono" aria-hidden="true" class="icono" />
      <span class="titulo">{{ titulo }}</span>
      <ChevronRight aria-hidden="true" class="flecha" />
      <span v-if="detalle" class="detalle">{{ pegarCifras(detalle) }}</span>
    </span>
  </RouterLink>
</template>

<style scoped>
.enlace-de-ajuste {
  display: block;
  /* El reparto de la fila depende del ancho real del enlace, no del de la ventana. */
  container-type: inline-size;
  min-height: var(--alto-boton-principal);
  padding: var(--espacio-2) var(--espacio-3);
  border: 2px solid var(--color-borde);
  border-radius: var(--radio);
  background: var(--color-fondo);
  color: var(--color-texto);
  text-decoration: none;
}
@media (hover: hover) {
  .enlace-de-ajuste:hover {
    background: var(--color-primario-suave);
  }
}
/* Ancho: ícono · (nombre sobre el detalle) · flecha. */
.contenido {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0 var(--espacio-3);
  min-height: calc(var(--alto-boton-principal) - 2 * var(--espacio-2) - 4px);
}
.icono {
  grid-column: 1;
  grid-row: 1 / span 2;
}
.titulo {
  grid-column: 2;
  grid-row: 1;
  font-weight: 700;
  color: var(--color-primario);
}
.flecha {
  grid-column: 3;
  grid-row: 1 / span 2;
}
.detalle {
  grid-column: 2;
  grid-row: 2;
  color: var(--color-texto-suave);
}
.icono,
.flecha {
  width: 1.4em;
  height: 1.4em;
  min-width: 24px;
  min-height: 24px;
}
.icono {
  color: var(--color-primario);
}
/* Angosto (celular con letra grande): ícono · nombre · flecha arriba y el detalle debajo, a todo
   el ancho, en vez de una columnita de dos palabras por renglón. */
@container (max-width: 22rem) {
  .icono,
  .flecha {
    grid-row: 1;
  }
  .detalle {
    grid-column: 1 / -1;
  }
}
</style>
