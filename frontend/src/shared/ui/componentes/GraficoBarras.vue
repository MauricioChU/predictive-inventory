<script setup lang="ts">
import { computed, useId } from 'vue'

interface Barra {
  etiqueta: string
  valor: number
  textoValor: string
  destacada?: boolean
}

const props = defineProps<{ barras: Barra[]; titulo: string }>()

// Q4: id realmente usado (antes quedaba puesto en un <p> sin que nada lo referenciara).
const idTitulo = useId()

const ALTO_BARRAS = 100
const ANCHO_BARRA = 10
const SEPARACION = 4

const maximo = computed(() => Math.max(1, ...props.barras.map((b) => b.valor)))
const ancho = computed(
  () => props.barras.length * ANCHO_BARRA + Math.max(0, props.barras.length - 1) * SEPARACION,
)
const barrasDibujadas = computed(() =>
  props.barras.map((barra, indice) => {
    const alto = Math.max(Math.round((barra.valor / maximo.value) * ALTO_BARRAS), 2)
    return {
      x: indice * (ANCHO_BARRA + SEPARACION),
      y: ALTO_BARRAS - alto,
      alto,
      ancho: ANCHO_BARRA,
    }
  }),
)
</script>

<template>
  <!--
    Q4: el SVG solo dibuja las barras (sin <text> dentro: su tamaño de letra no sigue la
    preferencia de la persona y a 360px queda minúsculo). Las etiquetas y valores van en HTML
    normal, con rem, para que escalen con el tamaño de letra. role="img" lleva solo el título
    (no un resumen de cada barra) para no anunciar el dato dos veces: la tabla .solo-lector es
    la única fuente de datos para lectores de pantalla (el SVG y las etiquetas visuales quedan
    aria-hidden).
  -->
  <figure class="grafico-barras" :aria-labelledby="idTitulo">
    <figcaption :id="idTitulo" class="titulo">{{ titulo }}</figcaption>

    <div class="visual" aria-hidden="true">
      <div class="fila valores">
        <span
          v-for="(barra, indice) in barras"
          :key="indice"
          class="valor"
          :class="{ 'valor--destacada': barra.destacada }"
          >{{ barra.textoValor }}</span
        >
      </div>

      <svg
        role="img"
        :aria-label="titulo"
        class="barras-svg"
        :viewBox="`0 0 ${ancho} ${ALTO_BARRAS}`"
        preserveAspectRatio="none"
      >
        <rect
          v-for="(barra, indice) in barrasDibujadas"
          :key="indice"
          class="barra"
          :class="{ 'barra--destacada': barras[indice]?.destacada }"
          :x="barra.x"
          :y="barra.y"
          :width="barra.ancho"
          :height="barra.alto"
        />
      </svg>

      <div class="fila etiquetas">
        <span
          v-for="(barra, indice) in barras"
          :key="indice"
          class="etiqueta"
          :class="{ 'etiqueta--destacada': barra.destacada }"
          >{{ barra.etiqueta }}</span
        >
      </div>
    </div>

    <table class="solo-lector">
      <caption>
        {{
          titulo
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">Etiqueta</th>
          <th scope="col">Valor</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(barra, indice) in barras" :key="indice">
          <th scope="row">{{ barra.etiqueta }}{{ barra.destacada ? ' (destacada)' : '' }}</th>
          <td>{{ barra.textoValor }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>

<style scoped>
.grafico-barras {
  margin: 0;
}
.titulo {
  font-weight: 700;
  margin: 0 0 var(--espacio-2);
}
.visual {
  display: flex;
  flex-direction: column;
}
.fila {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: var(--espacio-1);
  text-align: center;
}
.valor,
.etiqueta {
  /* Q4: texto normal en rem, escala con el tamaño de letra elegido; se envuelve por palabra
     en vez de desbordar si un valor es largo (p. ej. "S/ 1,200.00"). */
  font-size: 0.75rem;
  overflow-wrap: break-word;
  min-width: 0;
}
.valor {
  color: var(--color-texto);
  font-weight: 700;
}
.valor--destacada {
  color: var(--color-advertencia);
}
.etiqueta {
  color: var(--color-texto-suave);
  margin-top: var(--espacio-1);
}
.etiqueta--destacada {
  color: var(--color-texto);
  font-weight: 700;
}
.barras-svg {
  display: block;
  width: 100%;
  height: 120px;
  margin-block: var(--espacio-1);
  overflow: visible;
}
.barra {
  fill: var(--color-primario);
}
.barra--destacada {
  fill: var(--color-advertencia);
}
</style>
