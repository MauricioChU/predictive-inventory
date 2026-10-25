<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight, CircleCheck, Info, TriangleAlert } from 'lucide-vue-next'
import { pegarCifras } from '../texto-sin-cortes'

/**
 * Fila de aviso compacta: ícono + texto en una línea (si la letra es muy grande, baja a otra) +
 * flecha. Con `textoAccion` la flecha es un botón con ese nombre accesible ("Ver productos");
 * sin él, es solo un aviso. Varias se apilan una bajo otra sin alargar la pantalla (Inicio).
 * La flecha sola es una excepción deliberada a RN-UX-04: lleva nombre accesible y zona de 48 px.
 */
const props = withDefaults(
  defineProps<{
    tono: 'atencion' | 'info' | 'exito'
    texto: string
    /** Nombre accesible del botón; sin él la fila no es tocable. */
    textoAccion?: string
  }>(),
  { textoAccion: undefined },
)
const emit = defineEmits<{ accion: [] }>()

const ICONOS = { atencion: TriangleAlert, info: Info, exito: CircleCheck } as const
const icono = computed(() => ICONOS[props.tono])
</script>

<template>
  <div class="fila-de-aviso" :class="`fila-de-aviso--${tono}`">
    <component :is="icono" aria-hidden="true" class="icono" />
    <p class="texto">{{ pegarCifras(texto) }}</p>
    <button
      v-if="textoAccion"
      type="button"
      class="flecha"
      :aria-label="textoAccion"
      @click="emit('accion')"
    >
      <ChevronRight aria-hidden="true" class="icono-flecha" />
    </button>
  </div>
</template>

<style scoped>
.fila-de-aviso {
  --tono: var(--color-primario);
  --tono-suave: var(--color-primario-suave);
  display: flex;
  align-items: center;
  gap: var(--espacio-2);
  min-block-size: var(--alto-toque);
  padding: 0 var(--espacio-1) 0 var(--espacio-2);
  border: 2px solid var(--tono);
  border-inline-start-width: 5px;
  border-radius: var(--radio);
  background: var(--tono-suave);
  color: var(--color-texto);
}
.fila-de-aviso--atencion {
  --tono: var(--color-advertencia);
  --tono-suave: var(--color-advertencia-suave);
}
.fila-de-aviso--exito {
  --tono: var(--color-exito);
  --tono-suave: var(--color-exito-suave);
}
.icono {
  inline-size: 1.25rem;
  block-size: 1.25rem;
  flex: none;
  color: var(--tono);
}
.texto {
  flex: 1;
  min-inline-size: 0;
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  overflow-wrap: break-word;
}
.flecha {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  min-inline-size: var(--alto-toque);
  min-block-size: var(--alto-toque);
  margin-inline-start: calc(-1 * var(--espacio-1));
  border: none;
  border-radius: var(--radio-chico);
  background: none;
  color: var(--tono);
  cursor: pointer;
}
.icono-flecha {
  inline-size: 1.5rem;
  block-size: 1.5rem;
}
</style>
