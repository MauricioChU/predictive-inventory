<script setup lang="ts" generic="T">
import { computed, useId } from 'vue'
import type { Dia } from '@/shared/domain/fecha'
import { etiquetaDeDia } from '../etiquetas-de-dia'
import EstadoVacio from './EstadoVacio.vue'

const props = withDefaults(
  defineProps<{
    /** Ya agrupados y en el orden en que se muestran (lo más nuevo primero, en el Historial). */
    grupos: readonly { dia: Dia; items: readonly T[] }[]
    /** Día de negocio de hoy en la tienda (`diaDe(ahora)`), para "Hoy" / "Ayer". */
    hoy: Dia
    /** 2 en una pantalla propia (Historial); 3 si va dentro de una sección con su h2. */
    nivelEncabezado?: 2 | 3
    /** Clave estable de cada ítem (p. ej. su id). Sin ella se usa la posición. */
    claveDe?: (item: T) => string | number
    /** RN-UX-10: qué decir (y qué ofrecer) si no hay ningún ítem. */
    vacio?: { titulo: string; descripcion?: string; accion?: string }
  }>(),
  { nivelEncabezado: 2, claveDe: undefined, vacio: undefined },
)
const emit = defineEmits<{ accion: [] }>()
defineSlots<{ default: (contexto: { item: T; indice: number; dia: Dia }) => unknown }>()

const id = useId()
const conItems = computed(() => props.grupos.filter((grupo) => grupo.items.length > 0))
const idDelDia = (dia: Dia) => `${id}-${dia}`
const clave = (item: T, indice: number) => props.claveDe?.(item) ?? indice
</script>

<template>
  <div class="lista-agrupada-por-dia">
    <template v-if="conItems.length > 0">
      <div v-for="grupo in conItems" :key="grupo.dia" class="grupo">
        <component :is="`h${nivelEncabezado}`" :id="idDelDia(grupo.dia)" class="dia">
          {{ etiquetaDeDia(grupo.dia, hoy) }}
        </component>
        <!-- role="list": Safari quita la semántica de lista con list-style: none. -->
        <ul role="list" class="items" :aria-labelledby="idDelDia(grupo.dia)">
          <li v-for="(item, indice) in grupo.items" :key="clave(item, indice)" class="item">
            <slot :item="item" :indice="indice" :dia="grupo.dia" />
          </li>
        </ul>
      </div>
    </template>
    <EstadoVacio
      v-else-if="vacio"
      :titulo="vacio.titulo"
      :descripcion="vacio.descripcion"
      :accion="vacio.accion"
      @accion="emit('accion')"
    />
  </div>
</template>

<style scoped>
.grupo + .grupo {
  margin-top: var(--espacio-5);
}
.dia {
  margin: 0 0 var(--espacio-2);
  padding-bottom: var(--espacio-1);
  border-bottom: 2px solid var(--color-borde);
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-texto);
}
.items {
  display: flex;
  flex-direction: column;
  gap: var(--separacion-toque);
  margin: 0;
  padding: 0;
  list-style: none;
}
.item {
  min-width: 0;
}
</style>
