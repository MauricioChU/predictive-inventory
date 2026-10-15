<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'

withDefaults(defineProps<{ titulo: string; volver?: boolean }>(), { volver: false })
const emit = defineEmits<{ volver: [] }>()
const router = useRouter()

function alVolver() {
  emit('volver')
  router.back()
}
</script>

<template>
  <header class="encabezado-pagina">
    <button v-if="volver" type="button" class="volver" @click="alVolver">
      <ArrowLeft aria-hidden="true" class="icono" />
      <span>Volver</span>
    </button>
    <h1>{{ titulo }}</h1>
  </header>
</template>

<style scoped>
.encabezado-pagina {
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
  padding-block: var(--espacio-4);
}
h1 {
  font-size: 1.375rem;
  margin: 0;
}
.volver {
  display: inline-flex;
  align-items: center;
  gap: var(--espacio-1);
  min-height: var(--alto-toque);
  min-width: var(--alto-toque);
  padding-inline: var(--espacio-2);
  border: none;
  background: transparent;
  color: var(--color-primario);
  font-weight: 700;
  cursor: pointer;
}
.icono {
  width: 1.4em;
  height: 1.4em;
  flex: none;
}
</style>
