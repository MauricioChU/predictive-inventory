<script setup lang="ts">
import { useRoute } from 'vue-router'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'

const route = useRoute()
</script>

<template>
  <div class="pendiente-vista">
    <EncabezadoPagina
      :titulo="String(route.meta.titulo ?? '')"
      :volver="!route.meta.enNavegacion"
    />
    <p>Esta pantalla se construye en la próxima etapa</p>
  </div>
</template>

<style scoped>
.pendiente-vista p {
  color: var(--color-texto-suave);
}
</style>
