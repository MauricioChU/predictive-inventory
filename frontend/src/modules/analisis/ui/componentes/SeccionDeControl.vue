<script setup lang="ts">
import { useId, type Component } from 'vue'

defineProps<{
  /** El nombre de la sección, exacto de 04-torre-de-control ("Resumen", "Atención", …). */
  titulo: string
  /** Ícono decorativo junto al título (RN-UX-04: siempre con su texto). */
  icono: Component
}>()

const idTitulo = useId()
</script>

<template>
  <!-- Una tarjeta de la Torre de control: una región con nombre, para saltar entre secciones con
       el lector de pantalla (TalkBack lee "Resumen, región"). -->
  <section class="seccion-de-control" :aria-labelledby="idTitulo">
    <h2 :id="idTitulo" class="titulo">
      <component :is="icono" aria-hidden="true" class="icono" />
      <span>{{ titulo }}</span>
    </h2>
    <div class="cuerpo">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.seccion-de-control {
  /* Las piezas de adentro (cifras, filas, gráficos) se acomodan al ancho de la tarjeta. */
  container-type: inline-size;
  inline-size: 100%;
  min-inline-size: 0;
  padding: var(--espacio-4);
  border: 1px solid color-mix(in srgb, var(--color-borde) 45%, transparent);
  border-radius: var(--radio);
  background: var(--color-fondo);
}
/* Celular angosto (320–479 px): menos relleno, más ancho para las cifras y los nombres (con
   letra Muy grande, 16 px de cada lado dejaban palabras como "descuento" sin lugar). */
@media (max-width: 479px) {
  .seccion-de-control {
    padding: var(--espacio-3);
  }
}
.titulo {
  display: flex;
  align-items: center;
  gap: var(--espacio-2);
  margin: 0 0 var(--espacio-3);
  font-size: 1.2rem;
  line-height: 1.25;
}
.icono {
  inline-size: 1.3em;
  block-size: 1.3em;
  flex: none;
  color: var(--color-primario);
}
.cuerpo {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
}
</style>
