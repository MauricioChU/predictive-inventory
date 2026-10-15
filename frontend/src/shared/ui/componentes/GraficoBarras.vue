<script setup lang="ts">
import { computed, useId } from 'vue'
import { escalaComun } from '../escala-barras'

interface Barra {
  etiqueta: string
  valor: number
  textoValor: string
  destacada?: boolean
}

const props = defineProps<{ barras: Barra[]; titulo: string }>()

const idTitulo = useId()

const filas = computed(() => {
  const escala = escalaComun(props.barras.map((b) => b.valor))
  return props.barras.map((barra, indice) => ({
    ...barra,
    porcentaje: escala[indice]?.porcentaje ?? 0,
    visible: escala[indice]?.visible ?? false,
  }))
})
</script>

<template>
  <!--
    Barras horizontales en HTML con rem (siguen el tamaño de letra). El bloque visual queda
    aria-hidden: la tabla .solo-lector (envuelta en un DIV, no aplicada directo a la tabla — un
    <table> de layout automático ignora un width:1px y desborda) es la única fuente de datos
    para accesibilidad.

    N2 (ronda 4): antes cada fila era su propio flex y la pista medía "lo que dejaba SU valor",
    así que una barra al 100 % podía verse más corta que otra al 97 %. Ahora .filas es UNA sola
    grilla y cada .fila usa subgrid: las tres columnas (etiqueta · pista · valor) son las mismas
    para todas las filas, la pista mide lo mismo en todas y el largo de la barra es comparable.
    En un contenedor angosto (celular) cada fila pasa a dos líneas: etiqueta … valor arriba y la
    pista a todo el ancho debajo (igual para todas).
  -->
  <figure class="grafico-barras" :aria-labelledby="idTitulo">
    <figcaption :id="idTitulo" class="titulo">{{ titulo }}</figcaption>

    <div class="filas" aria-hidden="true">
      <div
        v-for="(fila, indice) in filas"
        :key="indice"
        class="fila"
        :class="{ 'fila--destacada': fila.destacada }"
      >
        <span class="etiqueta">{{ fila.etiqueta }}</span>
        <span class="pista">
          <span
            class="barra"
            :class="{ 'barra--visible': fila.visible }"
            :style="{ '--porcentaje': `${fila.porcentaje}%` }"
          />
        </span>
        <span class="valor">{{ fila.textoValor }}</span>
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
          <tr v-for="(barra, indice) in barras" :key="indice">
            <th scope="row">{{ barra.etiqueta }}{{ barra.destacada ? ' (destacada)' : '' }}</th>
            <td>{{ barra.textoValor }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </figure>
</template>

<style scoped>
.grafico-barras {
  margin: 0;
  /* Las filas deciden su forma (una o dos líneas) por el ancho real del gráfico, no del viewport. */
  container-type: inline-size;
}
.titulo {
  font-weight: 700;
  margin: 0 0 var(--espacio-3);
}
.filas {
  /* Una sola grilla para todas las filas: etiqueta (se envuelve si no cabe) · pista (al menos
     4rem, toma el resto) · valor (nunca se parte). */
  display: grid;
  grid-template-columns: minmax(0, max-content) minmax(4rem, 1fr) max-content;
  column-gap: var(--espacio-3);
  row-gap: var(--espacio-3);
  align-items: center;
}
.fila {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: subgrid;
  align-items: center;
  column-gap: var(--espacio-3);
  row-gap: var(--espacio-1);
  /* Marca de la fila destacada que no depende del color (RN-UX-04); transparente en las demás
     para que todas tengan el mismo sangrado. */
  border-left: 3px solid transparent;
  padding-left: var(--espacio-2);
}
.fila--destacada {
  border-left-color: var(--color-advertencia);
}
.etiqueta,
.valor {
  font-size: 0.85rem;
}
.etiqueta {
  grid-column: 1;
  color: var(--color-texto-suave);
  text-align: right;
  /* Sin puntos suspensivos: la etiqueta se envuelve por palabras. break-word (no el
     "anywhere" global de base.css) solo parte una palabra si ella sola no cabe en la línea. */
  overflow-wrap: break-word;
}
.fila--destacada .etiqueta {
  color: var(--color-texto);
  font-weight: 700;
}
.pista {
  grid-column: 2;
  height: min(1.25rem, 24px);
  background: var(--color-superficie);
  /* Base recta (todas las barras nacen de la misma línea) y extremo de datos redondeado. */
  border-radius: 0 4px 4px 0;
}
.barra {
  display: block;
  width: 0;
  height: 100%;
  background: var(--color-primario);
  border-radius: 0 4px 4px 0;
}
.barra--visible {
  /* Un valor > 0 nunca queda invisible, aunque sea muy chico frente al mayor. */
  width: max(4px, var(--porcentaje));
}
.fila--destacada .barra {
  background: var(--color-advertencia);
}
.valor {
  grid-column: 3;
  color: var(--color-texto);
  font-weight: 700;
  white-space: nowrap;
  text-align: right;
}
.fila--destacada .valor {
  color: var(--color-advertencia);
}

/* Celular (o cualquier contenedor angosto): dos líneas por fila. Arriba etiqueta … valor,
   abajo la pista a todo el ancho — el mismo ancho para todas las filas. */
@container (max-width: 22rem) {
  .filas {
    grid-template-columns: minmax(0, 1fr) max-content;
    row-gap: var(--espacio-4);
  }
  .etiqueta {
    grid-column: 1;
    grid-row: 1;
    text-align: left;
  }
  .valor {
    grid-column: 2;
    grid-row: 1;
  }
  .pista {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}
</style>
