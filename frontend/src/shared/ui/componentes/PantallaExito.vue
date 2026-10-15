<script setup lang="ts">
import { CircleCheck } from 'lucide-vue-next'

defineProps<{ titulo: string; detalle?: string }>()
</script>

<template>
  <!--
    Q2: sin role="status" aquí. Si una pantalla la monta dinámicamente (v-if) después de una
    operación, el contenido llegaría "ya lleno" al lector de pantalla, que puede no anunciarlo
    de forma confiable (el mismo problema que tenía el aviso Deshacer). La pantalla que la use
    debe anunciar el resultado con una región aria-live persistente propia (como hace LayoutApp
    con el aviso Deshacer) y/o mover el foco a este <h1> al mostrarla; este componente solo
    presenta el contenido visual.
  -->
  <div class="pantalla-exito">
    <CircleCheck aria-hidden="true" class="icono" />
    <h1>{{ titulo }}</h1>
    <p v-if="detalle" class="detalle">{{ detalle }}</p>
    <slot />
  </div>
</template>

<style scoped>
.pantalla-exito {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--espacio-3);
  padding: var(--espacio-6) var(--espacio-4);
  text-align: center;
  color: var(--color-exito);
}
.icono {
  width: 4rem;
  height: 4rem;
}
h1 {
  font-size: 1.375rem;
  margin: 0;
  color: var(--color-texto);
}
.detalle {
  margin: 0;
  color: var(--color-texto-suave);
}
</style>
