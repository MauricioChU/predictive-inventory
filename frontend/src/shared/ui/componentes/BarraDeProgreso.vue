<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    actual: number
    total: number
    /** "Llevas 1 de 3". */
    texto: string
    /** Nombre del progressbar para el lector de pantalla. */
    etiqueta?: string
  }>(),
  { etiqueta: 'Avance' },
)

const maximo = computed(() => Math.max(0, props.total))
const ahora = computed(() => Math.min(maximo.value, Math.max(0, props.actual)))
const fraccion = computed(() => (maximo.value > 0 ? ahora.value / maximo.value : 0))
</script>

<template>
  <div class="barra-de-progreso">
    <!-- Se ve, pero lo lee el progressbar (aria-valuetext): así no se oye dos veces. -->
    <p class="texto" aria-hidden="true">{{ texto }}</p>
    <div
      role="progressbar"
      class="pista"
      :aria-label="etiqueta"
      aria-valuemin="0"
      :aria-valuemax="maximo"
      :aria-valuenow="ahora"
      :aria-valuetext="texto"
    >
      <div class="relleno" :style="{ transform: `scaleX(${fraccion})` }" />
    </div>
  </div>
</template>

<style scoped>
.texto {
  margin: 0 0 var(--espacio-2);
  font-weight: 700;
}
/* Barra gruesa; el borde (≥ 3:1 sobre el fondo) marca dónde termina aunque falte todo, y el
   relleno contrasta ≥ 3:1 con la pista vacía. */
.pista {
  height: max(1rem, 16px);
  border: 2px solid var(--color-borde);
  border-radius: 999px;
  background: var(--color-fondo);
  overflow: hidden;
}
/* Crece con transform (no con width): no reacomoda nada al avanzar. */
.relleno {
  width: 100%;
  height: 100%;
  background: var(--color-primario);
  transform-origin: left center;
  transition: transform 200ms ease-out;
}
</style>
