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
  Ronda 1 (RN-UX-01): el nombre va SIEMPRE a 1rem (la letra elegida); lo que cambia con el ancho
  es la cantidad de columnas, nunca la letra. Una palabra de 13 letras ("Limpiavidrios",
  "Desinfectante") en negrita mide ~6.4rem, y cada botón suma ~1rem de relleno y borde:
  - 4 columnas desde 600 px (plan 09b), si el componente mide más de 32rem;
  - si no, 2 columnas, si mide más de 15.75rem;
  - si no (celular con letra Muy grande, 320 px con Grande), UNA columna de filas: foto al lado
    del nombre, como una tarjeta (≥ 64 px de alto).
  En rem, los cortes siguen la letra elegida. El componente es el contenedor de consulta: mide
  lo que tiene de verdad (p. ej. la columna del buscador en PC), no el viewport.
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
@container (max-width: 32rem) {
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
  font-size: 1rem;
  /* Un flex item no se encoge por debajo de su palabra más larga: sin esto, una palabra que no
     entra sale por los costados del botón en vez de partirse como último recurso. */
  min-inline-size: 0;
  max-inline-size: 100%;
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

/* Una columna de filas: foto a la izquierda, nombre a la derecha (como TarjetaDeProducto). */
@container (max-width: 15.75rem) {
  .grilla {
    grid-template-columns: minmax(0, 1fr);
  }
  .acceso {
    flex-direction: row;
    gap: var(--espacio-3);
    min-block-size: max(64px, 3.5rem);
    padding: var(--espacio-2) var(--espacio-3);
  }
  .foto {
    --foto-lado: 56px;
  }
  .nombre {
    text-align: start;
  }
}
</style>
