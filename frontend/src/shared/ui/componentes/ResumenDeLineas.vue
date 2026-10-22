<script setup lang="ts">
import { pegarCifras } from '../texto-sin-cortes'

/** Una línea de lo que se registró: "2 unid. × S/ 3.50", su importe y, si va, una marca. */
export interface LineaDeResumen {
  id: string
  nombre: string
  detalle: string
  importe: string
  /** Marca de la línea: "Precio especial" (venta) o "Costo nuevo" (llegada). */
  marca?: string
}

defineProps<{ lineas: LineaDeResumen[]; etiqueta: string }>()
</script>

<template>
  <ul v-if="lineas.length > 0" class="resumen-de-lineas" :aria-label="etiqueta">
    <li v-for="linea in lineas" :key="linea.id" class="linea">
      <span class="nombre">{{ linea.nombre }}</span>
      <span class="importe">{{ linea.importe }}</span>
      <span class="detalle">
        {{ pegarCifras(linea.detalle) }}<template v-if="linea.marca"> · {{ linea.marca }}</template>
      </span>
    </li>
  </ul>
</template>

<style scoped>
.resumen-de-lineas {
  display: grid;
  gap: var(--espacio-2);
  inline-size: 100%;
  max-inline-size: 28rem;
  margin: var(--espacio-2) 0 0;
  padding: var(--espacio-3) var(--espacio-4);
  border: 1px solid var(--color-borde-foto);
  border-radius: var(--radio);
  background: var(--color-superficie);
  color: var(--color-texto);
  list-style: none;
  text-align: start;
}
.linea {
  /* Nombre e importe en una fila; si el nombre no entra sin partir una palabra (320 px, letra
     Muy grande), el importe baja a su propia fila. */
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--espacio-3);
}
.linea + .linea {
  padding-block-start: var(--espacio-2);
  border-block-start: 1px solid var(--color-borde-foto);
}
.nombre {
  flex: 1 1 8rem;
  font-weight: 700;
}
.importe {
  margin-inline-start: auto;
  font-weight: 700;
  white-space: nowrap;
}
.detalle {
  flex-basis: 100%;
  color: var(--color-texto-suave);
}
</style>
