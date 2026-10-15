<script setup lang="ts">
import { computed, useId } from 'vue'

interface Barra {
  etiqueta: string
  valor: number
  textoValor: string
  destacada?: boolean
}

const props = defineProps<{ barras: Barra[]; titulo: string }>()

const idTitulo = useId()

const ALTO = 180
const ALTO_BARRAS = 120
const ANCHO_BARRA = 40
const SEPARACION = 16
const ANCHO = computed(
  () => props.barras.length * ANCHO_BARRA + Math.max(0, props.barras.length - 1) * SEPARACION + SEPARACION * 2,
)
const maximo = computed(() => Math.max(1, ...props.barras.map((b) => b.valor)))

const barrasDibujadas = computed(() =>
  props.barras.map((barra, indice) => {
    const alto = Math.round((barra.valor / maximo.value) * ALTO_BARRAS)
    const x = SEPARACION + indice * (ANCHO_BARRA + SEPARACION)
    const y = ALTO_BARRAS - alto
    return { ...barra, x, y, alto, ancho: ANCHO_BARRA }
  }),
)

const resumenAccesible = computed(() => {
  const partes = props.barras.map((b) => `${b.etiqueta}: ${b.textoValor}${b.destacada ? ' (destacada)' : ''}`)
  return `Gráfico de barras: ${props.titulo}. ${partes.join('. ')}.`
})
</script>

<template>
  <figure class="grafico-barras">
    <p :id="idTitulo" class="titulo">{{ titulo }}</p>
    <svg
      role="img"
      :aria-label="resumenAccesible"
      :viewBox="`0 0 ${ANCHO} ${ALTO}`"
      preserveAspectRatio="xMidYMid meet"
    >
      <line class="linea-base" x1="0" :y1="ALTO_BARRAS" :x2="ANCHO" :y2="ALTO_BARRAS" />
      <g v-for="barra in barrasDibujadas" :key="barra.etiqueta">
        <rect
          class="barra"
          :class="{ 'barra--destacada': barra.destacada }"
          :x="barra.x"
          :y="barra.y"
          :width="barra.ancho"
          :height="Math.max(barra.alto, 2)"
          rx="4"
        />
        <text class="valor" :x="barra.x + barra.ancho / 2" :y="barra.y - 6" text-anchor="middle">
          {{ barra.textoValor }}
        </text>
        <text
          class="etiqueta"
          :class="{ 'etiqueta--destacada': barra.destacada }"
          :x="barra.x + barra.ancho / 2"
          :y="ALTO_BARRAS + 20"
          text-anchor="middle"
        >
          {{ barra.etiqueta }}
        </text>
      </g>
    </svg>
    <table class="solo-lector">
      <caption>{{ titulo }}</caption>
      <thead>
        <tr>
          <th scope="col">Etiqueta</th>
          <th scope="col">Valor</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="barra in barras" :key="barra.etiqueta">
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
svg {
  width: 100%;
  height: auto;
  max-height: 220px;
  overflow: visible;
}
.linea-base {
  stroke: var(--color-borde);
  stroke-width: 1;
}
.barra {
  fill: var(--color-primario);
}
.barra--destacada {
  fill: var(--color-advertencia);
}
.valor {
  fill: var(--color-texto);
  font-size: 11px;
  font-weight: 700;
}
.etiqueta {
  fill: var(--color-texto-suave);
  font-size: 11px;
}
.etiqueta--destacada {
  fill: var(--color-texto);
  font-weight: 700;
}
</style>
