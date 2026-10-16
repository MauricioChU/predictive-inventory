<script setup lang="ts">
import { getCurrentInstance } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'

withDefaults(defineProps<{ titulo: string; volver?: boolean }>(), { volver: false })
const emit = defineEmits<{ volver: [] }>()
const router = useRouter()
// `useAttrs()` no sirve aquí: Vue quita de $attrs los listeners que coinciden con un emit
// declarado. El vnode "crudo" del padre sí conserva onVolver si lo pasó, y es lo que
// necesitamos para saber si el padre quiere manejar el volver él mismo.
const instancia = getCurrentInstance()

function tieneListenerVolver(): boolean {
  return instancia?.vnode.props?.onVolver !== undefined
}

function alVolver() {
  // Q3: "router.back() o emit('volver')", no ambos. Si el padre escucha @volver, le dejamos
  // el control (p. ej. para confirmar antes de salir); si no, navegamos nosotros.
  if (tieneListenerVolver()) {
    emit('volver')
    return
  }
  const haySalidaPrevia = Boolean((window.history.state as { back?: string | null } | null)?.back)
  if (haySalidaPrevia) {
    router.back()
  } else {
    // Primera pantalla de la sesión (p. ej. se abrió directo en /ajustes): no hay a dónde
    // "volver", así que no dejamos un callejón sin salida (RN-UX-15) y vamos a Inicio. Con
    // replace (no push) para no dejar esta pantalla sin salida en el historial tampoco.
    void router.replace({ name: 'inicio' })
  }
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
/* Plan 14: "Volver" nunca se encoge (antes, junto a un título largo con letra Muy grande, quedaba
   una letra por renglón). Si el título no cabe a su lado, baja a su propia línea, entero. */
.encabezado-pagina {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--espacio-2) var(--espacio-3);
  padding-block: var(--espacio-4);
}
h1 {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 1.375rem;
  margin: 0;
}
.volver {
  flex: none;
  white-space: nowrap;
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
