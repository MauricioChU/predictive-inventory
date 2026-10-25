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
  <header class="encabezado-pagina" :class="{ 'encabezado-pagina--con-volver': volver }">
    <button v-if="volver" type="button" class="volver" @click="alVolver">
      <ArrowLeft aria-hidden="true" class="icono" />
      <span>Volver</span>
    </button>
    <h1>{{ titulo }}</h1>
    <!-- Acción opcional al lado del título (p. ej. «Categorías»): no cambia la altura del encabezado. -->
    <div v-if="$slots.accion" class="accion">
      <slot name="accion" />
    </div>
  </header>
</template>

<style scoped>
/*
  Plan 13: a 320 px con letra Muy grande, "Volver" se encogía hasta quedar una letra por línea
  (el título largo, "¿Necesito comprar?", se llevaba todo el ancho y el texto se partía en
  cualquier parte). Ahora "Volver" nunca se encoge ni se parte, y si el título no cabe a su
  lado (menos de 10rem), baja a su propia línea.
*/
.encabezado-pagina {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--espacio-1) var(--espacio-3);
  padding-block: var(--espacio-4);
}
/* Con "Volver", el título va debajo, en su propia fila (no pegado al botón). */
.encabezado-pagina--con-volver {
  row-gap: 0;
  padding-block-start: var(--espacio-1);
}
.encabezado-pagina--con-volver h1 {
  flex-basis: 100%;
  padding-inline: var(--espacio-2);
}
h1 {
  flex: 1 1 10rem;
  min-inline-size: 0;
  font-size: 1.375rem;
  margin: 0;
  overflow-wrap: break-word;
}
/* Su caja mide 0 de alto: el botón (48 px) sobresale sin estirar el encabezado, así el título
   queda a la misma altura que en las demás vistas. */
.accion {
  flex: none;
  display: flex;
  align-items: center;
  margin-block: calc(-0.5 * var(--alto-toque));
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
