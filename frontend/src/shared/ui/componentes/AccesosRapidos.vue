<script setup lang="ts">
import { computed } from 'vue'
import { MAXIMO_DE_ACCESOS_RAPIDOS, type AccesoRapido } from '../tipos-de-productos'
import FotoDeProducto from './FotoDeProducto.vue'

const props = withDefaults(
  defineProps<{
    /** Los más vendidos primero; se muestran como máximo 8. */
    productos: AccesoRapido[]
    /** Nombre de la lista para el lector de pantalla. */
    etiqueta?: string
  }>(),
  { etiqueta: 'Más vendidos' },
)
const emit = defineEmits<{ elegir: [id: string] }>()

const visibles = computed(() => props.productos.slice(0, MAXIMO_DE_ACCESOS_RAPIDOS))
</script>

<template>
  <div v-if="visibles.length > 0" class="accesos-rapidos">
    <ul class="grilla" role="list" :aria-label="etiqueta">
      <li v-for="producto in visibles" :key="producto.id" class="item">
        <button type="button" class="acceso" @click="emit('elegir', producto.id)">
          <FotoDeProducto
            class="foto"
            :imagen="producto.imagen"
            :nombre="producto.nombre"
            :categoria="producto.categoria"
            tamano="mediana"
            decorativa
          />
          <span class="nombre">{{ producto.nombre }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/*
  2 columnas en celular (320–599 px) y 4 desde 600 px (plan 09b). Además, el componente es
  contenedor de consulta: si él mismo es angosto (letra Muy grande en una tablet chica, o la
  columna del buscador en PC), vuelve a 2 columnas — con 4 columnas de ~130 px y letra de 24 px
  una palabra como "Limpiavidrios" ya no entraría y se partiría (RN-UX-09).
*/
.accesos-rapidos {
  container-type: inline-size;
}
.grilla {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: max(var(--separacion-toque), var(--espacio-2));
  margin: 0;
  padding: 0;
  list-style: none;
}
@media (min-width: 600px) {
  .grilla {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@container (max-width: 26rem) {
  .grilla {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.item {
  display: flex;
  min-inline-size: 0;
}
.acceso {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: var(--espacio-2);
  inline-size: 100%;
  min-block-size: var(--alto-toque);
  padding: var(--espacio-2) var(--espacio-2) var(--espacio-3);
  border: 2px solid var(--color-borde);
  border-radius: var(--radio);
  background: var(--color-fondo);
  color: var(--color-texto);
  cursor: pointer;
  transition:
    background-color 80ms ease-out,
    transform 80ms ease-out;
  -webkit-tap-highlight-color: transparent;
}
.acceso:hover {
  background: var(--color-primario-suave);
}
.acceso:active {
  background: var(--color-primario-suave);
  border-color: var(--color-primario);
  transform: scale(0.97);
}
.foto {
  /* Ocupa lo que la mediana pide, pero nunca más que el ancho del botón. */
  max-inline-size: 100%;
}
.nombre {
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
  /* Tres líneas como máximo, envolviendo entre palabras. */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
  overflow-wrap: break-word;
  word-break: normal;
  hyphens: none;
}
</style>
