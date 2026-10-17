<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

const props = defineProps<{ productoId: string }>()

// El detalle del producto (`producto`, /productos/:id) es de la rama 11 (contrato de rutas de
// la Ola 4). Enlazar por nombre a una ruta que no existe rompe la pantalla, así que mientras no
// exista se muestra lo mismo sin enlace.
const router = useRouter()
const destino = computed(() =>
  router.hasRoute('producto') ? { name: 'producto', params: { id: props.productoId } } : null,
)
</script>

<template>
  <RouterLink v-if="destino" :to="destino" class="enlace-a-producto">
    <slot />
  </RouterLink>
  <span v-else class="enlace-a-producto enlace-a-producto--sin-detalle"><slot /></span>
</template>

<style scoped>
.enlace-a-producto {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0 var(--espacio-3);
  min-block-size: var(--alto-toque);
  padding: var(--espacio-2) 0;
  color: var(--color-texto);
  overflow-wrap: break-word;
}
a.enlace-a-producto {
  color: var(--color-primario);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
</style>
