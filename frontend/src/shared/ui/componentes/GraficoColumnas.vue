<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue'
import { escalaComun } from '../escala-barras'

interface Columna {
  etiqueta: string
  valor: number
  textoValor: string
  destacada?: boolean
}

const props = defineProps<{ columnas: Columna[]; titulo: string; descripcion: string }>()

const idTitulo = useId()
const refRegion = ref<HTMLElement | null>(null)

const filas = computed(() => {
  const escala = escalaComun(props.columnas.map((c) => c.valor))
  return props.columnas.map((columna, indice) => ({
    ...columna,
    porcentaje: escala[indice]?.porcentaje ?? 0,
    visible: escala[indice]?.visible ?? false,
  }))
})

// Si no entran todas, la columna destacada queda a la vista (centrada) al abrir.
onMounted(() => {
  const region = refRegion.value
  const destacada = region?.querySelector<HTMLElement>('.columna--destacada')
  if (!region || !destacada || region.scrollWidth <= region.clientWidth) return
  region.scrollLeft = destacada.offsetLeft - (region.clientWidth - destacada.offsetWidth) / 2
})
</script>

<template>
  <!--
    Barras verticales en HTML con rem (siguen el tamaño de letra). Cada columna mide lo mismo de
    ancho y todas se ven: si no caben en el ancho del bloque, el gráfico se desplaza de lado POR
    DENTRO (la página no se mueve, RN-UX-09) y el teclado lo alcanza (Tab y flechas). La parte
    visual queda aria-hidden: la tabla .solo-lector es la única fuente de datos para el lector de
    pantalla, igual que en GraficoBarras. Escala común: el mismo valor, la misma altura.
  -->
  <figure class="grafico-columnas" :aria-labelledby="idTitulo">
    <figcaption :id="idTitulo" class="titulo">{{ titulo }}</figcaption>

    <div
      ref="refRegion"
      class="region"
      data-desplaza-de-lado
      role="region"
      tabindex="0"
      :aria-label="descripcion"
    >
      <div class="columnas" aria-hidden="true">
        <div
          v-for="(fila, indice) in filas"
          :key="indice"
          class="columna"
          :class="{ 'columna--destacada': fila.destacada }"
        >
          <span class="valor">{{ fila.textoValor }}</span>
          <span class="pista">
            <span
              class="barra"
              :class="{ 'barra--visible': fila.visible }"
              :style="{ '--porcentaje': `${fila.porcentaje}%` }"
            />
          </span>
          <span class="etiqueta">{{ fila.etiqueta }}</span>
        </div>
      </div>
    </div>

    <div class="solo-lector">
      <table>
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
          <tr v-for="(columna, indice) in columnas" :key="indice">
            <th scope="row">{{ columna.etiqueta }}{{ columna.destacada ? ' (destacada)' : '' }}</th>
            <td>{{ columna.textoValor }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </figure>
</template>

<style scoped>
.grafico-columnas {
  margin: 0;
  min-inline-size: 0;
}
.titulo {
  font-weight: 700;
  margin: 0 0 var(--espacio-3);
}
/* Se desplaza de lado dentro del bloque; el borde de foco se ve (zona de 48 px no aplica: no es un botón). */
.region {
  /* Referencia de offsetLeft para centrar la columna destacada al abrir. */
  position: relative;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding-block-end: var(--espacio-1);
  border-radius: var(--radio-chico);
}
.columnas {
  display: flex;
  gap: var(--espacio-2);
  /* Si entran, se reparten el ancho; si no, cada una conserva su mínimo y el resto se desplaza. */
  inline-size: max-content;
  min-inline-size: 100%;
}
.columna {
  flex: 1 0 4.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--espacio-1);
  /* La marca de la destacada no depende del color (RN-UX-04): raya arriba. */
  border-block-start: 3px solid transparent;
  padding-block-start: var(--espacio-1);
}
.columna--destacada {
  border-block-start-color: var(--color-advertencia);
}
.valor,
.etiqueta {
  font-size: 0.85rem;
  text-align: center;
  white-space: nowrap;
}
.valor {
  color: var(--color-texto);
  font-weight: 700;
}
.etiqueta {
  color: var(--color-texto-suave);
}
.columna--destacada .etiqueta {
  color: var(--color-texto);
  font-weight: 700;
}
.columna--destacada .valor {
  color: var(--color-advertencia);
}
/* Pista de alto fijo: todas las barras nacen de la misma línea de abajo. */
.pista {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  block-size: 7rem;
  inline-size: 100%;
}
.barra {
  display: block;
  inline-size: 60%;
  max-inline-size: 2.5rem;
  block-size: 0;
  background: var(--color-primario);
  border-radius: 4px 4px 0 0;
}
.barra--visible {
  /* Un valor > 0 nunca queda invisible, aunque sea muy chico frente al mayor. */
  block-size: max(4px, var(--porcentaje));
}
.columna--destacada .barra {
  background: var(--color-advertencia);
}
</style>
