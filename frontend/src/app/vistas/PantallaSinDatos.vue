<script setup lang="ts">
import { computed } from 'vue'
import { RotateCcw } from 'lucide-vue-next'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import type { MotivoSinDatos } from '../motivo-sin-datos'

/**
 * Se muestra en lugar de la app cuando no puede usar los datos: al arrancar (IndexedDB no
 * disponible, sin espacio, otra falla) o después, si otra pestaña actualizó la base. RN-UX-07:
 * dice qué pasó y qué hacer, sin códigos técnicos. El botón vuelve a abrir la app.
 */
const props = withDefaults(defineProps<{ motivo?: MotivoSinDatos; alReintentar?: () => void }>(), {
  motivo: 'otro',
  alReintentar: () => window.location.reload(),
})

const TEXTOS: Record<MotivoSinDatos, { titulo: string; parrafos: string[]; boton: string }> = {
  'sin-indexeddb': {
    titulo: 'No pudimos abrir tus datos',
    parrafos: [
      'Este navegador no está dejando que la app guarde tus productos y ventas.',
      'Si abriste la app en una ventana privada o de incógnito, ábrela en una ventana normal. Si sigue igual, cierra el navegador y vuelve a abrirlo.',
    ],
    boton: 'Intentar de nuevo',
  },
  'sin-espacio': {
    titulo: 'No pudimos abrir tus datos',
    parrafos: [
      'Tu celular no tiene espacio libre para guardar datos. Libera espacio y vuelve a abrir la app.',
    ],
    boton: 'Intentar de nuevo',
  },
  otro: {
    titulo: 'No pudimos abrir tus datos',
    parrafos: [
      'Cierra y vuelve a abrir la app. Si sigue pasando, avísale a quien te ayuda con la app.',
    ],
    boton: 'Intentar de nuevo',
  },
  actualizada: {
    titulo: 'La app se actualizó',
    parrafos: [],
    boton: 'Toca para volver a abrirla',
  },
}

const texto = computed(() => TEXTOS[props.motivo])
</script>

<template>
  <main id="contenido" class="pantalla-sin-datos">
    <h1>{{ texto.titulo }}</h1>
    <p v-for="parrafo in texto.parrafos" :key="parrafo">{{ parrafo }}</p>
    <BotonPrincipal :texto="texto.boton" :icono="RotateCcw" @click="props.alReintentar()" />
  </main>
</template>

<style scoped>
.pantalla-sin-datos {
  display: grid;
  gap: var(--espacio-4);
  max-width: var(--ancho-contenido);
  margin-inline: auto;
  padding: var(--espacio-6) var(--espacio-4);
}
.pantalla-sin-datos h1,
.pantalla-sin-datos p {
  margin: 0;
}
</style>
