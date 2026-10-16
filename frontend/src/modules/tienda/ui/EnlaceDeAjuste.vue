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
    <component :is="icono" aria-hidden="true" class="icono" />
    <span class="textos">
      <span class="titulo">{{ titulo }}</span>
      <span v-if="detalle" class="detalle">{{ pegarCifras(detalle) }}</span>
    </span>
    <ChevronRight aria-hidden="true" class="flecha" />
  </RouterLink>
</template>

<style scoped>
.enlace-de-ajuste {
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
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
.textos {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.titulo {
  font-weight: 700;
  color: var(--color-primario);
}
.detalle {
  color: var(--color-texto-suave);
}
.icono,
.flecha {
  width: 1.4em;
  height: 1.4em;
  min-width: 24px;
  min-height: 24px;
  flex: none;
}
.icono {
  color: var(--color-primario);
}
</style>
