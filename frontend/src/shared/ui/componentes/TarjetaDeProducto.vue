<script setup lang="ts">
import { computed, useId } from 'vue'
import type { DatosDeTarjetaDeProducto } from '../tipos-de-productos'
import FotoDeProducto from './FotoDeProducto.vue'
import InsigniaEstado from './InsigniaEstado.vue'

const props = withDefaults(defineProps<DatosDeTarjetaDeProducto>(), {
  imagen: undefined,
  categoria: undefined,
  textoPrecio: undefined,
  estado: undefined,
  textoSecundario: undefined,
})
const emit = defineEmits<{ elegir: [] }>()

const id = useId()
const ids = {
  nombre: `${id}-nombre`,
  stock: `${id}-stock`,
  precio: `${id}-precio`,
  estado: `${id}-estado`,
  secundario: `${id}-secundario`,
}

/** Nombre accesible = nombre + stock (plan 09b); lo demás se lee después, como descripción. */
const nombreAccesible = `${ids.nombre} ${ids.stock}`
const descripcion = computed(() => {
  const partes = [
    props.textoPrecio ? ids.precio : undefined,
    props.estado ? ids.estado : undefined,
    props.textoSecundario ? ids.secundario : undefined,
  ].filter((parte): parte is string => parte !== undefined)
  return partes.length > 0 ? partes.join(' ') : undefined
})
</script>

<template>
  <!-- Un solo botón: toda la fila es tocable (RN-UX-02) y el lector la lee de una vez. Adentro
       solo hay <span> (contenido de frase, lo único válido dentro de un <button>). -->
  <button
    type="button"
    class="tarjeta-de-producto"
    :aria-labelledby="nombreAccesible"
    :aria-describedby="descripcion"
    @click="emit('elegir')"
  >
    <span class="contenido">
      <FotoDeProducto
        class="foto"
        :imagen="imagen"
        :nombre="nombre"
        :categoria="categoria"
        tamano="mediana"
        decorativa
      />
      <span :id="ids.nombre" class="nombre">{{ nombre }}</span>
      <span class="cifras">
        <span :id="ids.stock" class="stock">{{ textoStock }}</span>
        <span v-if="textoPrecio" :id="ids.precio" class="precio">{{ textoPrecio }}</span>
      </span>
      <span v-if="estado || textoSecundario" class="extras">
        <span v-if="estado" :id="ids.estado" class="estado"
          ><InsigniaEstado :estado="estado"
        /></span>
        <span v-if="textoSecundario" :id="ids.secundario" class="secundario">{{
          textoSecundario
        }}</span>
      </span>
    </span>
  </button>
</template>

<style scoped>
.tarjeta-de-producto {
  /* La tarjeta es el contenedor de consulta: su forma depende del ancho que de verdad tiene
     (columna de Vender en PC, celular de 320 px con letra Muy grande…), no del viewport. */
  container-type: inline-size;
  display: block;
  inline-size: 100%;
  min-block-size: max(64px, 3.5rem);
  padding: var(--espacio-3);
  border: 2px solid transparent;
  border-radius: var(--radio);
  background: var(--color-superficie);
  color: var(--color-texto);
  text-align: start;
  cursor: pointer;
  transition:
    background-color 80ms ease-out,
    transform 80ms ease-out;
  -webkit-tap-highlight-color: transparent;
}
.tarjeta-de-producto:hover {
  background: var(--color-primario-suave);
}
/* Respuesta inmediata al toque (< 100 ms): se hunde apenas y marca el borde. */
.tarjeta-de-producto:active {
  background: var(--color-primario-suave);
  border-color: var(--color-primario);
  transform: scale(0.985);
}
.contenido {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-areas:
    'foto nombre'
    'foto cifras'
    'foto extras';
  align-items: center;
  column-gap: var(--espacio-3);
  row-gap: var(--espacio-1);
}
.foto {
  grid-area: foto;
  align-self: center;
}
.nombre {
  grid-area: nombre;
  align-self: end;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.25;
  /* Dos líneas como máximo y sin cortar palabras: se envuelve solo entre palabras
     (break-word parte una palabra únicamente si ella sola no cabe en toda la línea). */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  overflow-wrap: break-word;
  word-break: normal;
  hyphens: none;
}
.cifras {
  grid-area: cifras;
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--espacio-3);
  min-inline-size: 0;
}
.extras {
  grid-area: extras;
  align-self: start;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--espacio-1) var(--espacio-3);
  min-inline-size: 0;
}
.stock,
.precio {
  font-weight: 700;
  white-space: nowrap;
}
.precio {
  color: var(--color-primario);
}
.secundario {
  flex-basis: 100%;
  color: var(--color-texto-suave);
  font-size: 0.9rem;
  overflow-wrap: break-word;
}

/* Algo angosta (celular con letra Muy grande): foto un poco más chica para que el nombre
   tenga lugar. */
@container (max-width: 15rem) {
  .contenido {
    --foto-lado: 64px;
  }
}
/* Muy angosta (320–360 px con letra Muy grande, 320 px con Grande): el nombre y el estado
   pasan a su propia línea, a todo el ancho, y la foto queda al lado del stock y el precio.
   Así una palabra larga ("Limpiavidrios") entra entera en vez de partirse, y "Queda poco" no
   se parte en dos. */
@container (max-width: 13rem) {
  .contenido {
    --foto-lado: 56px;
    grid-template-areas:
      'nombre nombre'
      'foto cifras'
      'extras extras';
    row-gap: var(--espacio-2);
  }
  .cifras {
    flex-direction: column;
  }
}
</style>
