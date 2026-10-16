<script setup lang="ts">
import { RotateCcw } from 'lucide-vue-next'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'

/**
 * Se muestra en lugar de la app cuando el navegador no deja abrir los datos (IndexedDB no
 * disponible o bloqueado, p. ej. en algunas ventanas privadas). RN-UX-07: dice qué pasó y qué
 * hacer, sin códigos técnicos.
 */
const props = withDefaults(defineProps<{ alReintentar?: () => void }>(), {
  alReintentar: () => window.location.reload(),
})
</script>

<template>
  <main id="contenido" class="error-de-arranque">
    <h1>No pudimos abrir tus datos</h1>
    <p>Este navegador no está dejando que la app guarde tus productos y ventas.</p>
    <p>
      Si abriste la app en una ventana privada o de incógnito, ábrela en una ventana normal. Si
      sigue igual, cierra el navegador y vuelve a abrirlo.
    </p>
    <BotonPrincipal texto="Intentar de nuevo" :icono="RotateCcw" @click="props.alReintentar()" />
  </main>
</template>

<style scoped>
.error-de-arranque {
  display: grid;
  gap: var(--espacio-4);
  max-width: var(--ancho-contenido);
  margin-inline: auto;
  padding: var(--espacio-6) var(--espacio-4);
}
.error-de-arranque h1 {
  margin: 0;
}
.error-de-arranque p {
  margin: 0;
}
</style>
