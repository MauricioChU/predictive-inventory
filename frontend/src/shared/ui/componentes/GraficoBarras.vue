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

const maximo = computed(() => Math.max(1, ...props.barras.map((b) => b.valor)))
const filas = computed(() =>
  props.barras.map((barra) => ({
    ...barra,
    porcentaje: Math.max(Math.round((barra.valor / maximo.value) * 100), 2),
  })),
)
</script>

<template>
  <!--
    Hallazgo 2: antes había 7 columnas de 1fr con overflow-wrap:break-word, y un valor largo
    como "S/ 1,200.00" se partía a mitad de número. Ahora cada barra es una FILA horizontal
    (etiqueta · barra proporcional · valor), así el valor siempre tiene todo el ancho del
    gráfico disponible y nunca necesita envolverse. Todo en HTML con rem (sigue el tamaño de
    letra). El bloque visual queda aria-hidden: la tabla .solo-lector (envuelta en un DIV, no
    aplicada directo a la tabla — un <table> de layout automático ignora un width:1px y
    desborda) es la única fuente de datos para accesibilidad.
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
          <span class="barra" :style="{ width: fila.porcentaje + '%' }" />
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
}
.titulo {
  font-weight: 700;
  margin: 0 0 var(--espacio-3);
}
.filas {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-2);
}
.fila {
  display: flex;
  align-items: center;
  gap: var(--espacio-2);
  border-left: 3px solid transparent;
  padding-left: var(--espacio-2);
}
.fila--destacada {
  border-left-color: var(--color-advertencia);
}
.etiqueta,
.valor {
  font-size: 0.85rem;
  flex: none;
  white-space: nowrap;
}
.etiqueta {
  width: 3.5rem;
  color: var(--color-texto-suave);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fila--destacada .etiqueta {
  color: var(--color-texto);
  font-weight: 700;
}
.valor {
  color: var(--color-texto);
  font-weight: 700;
  min-width: 4.5rem;
}
.fila--destacada .valor {
  color: var(--color-advertencia);
}
.pista {
  flex: 1 1 auto;
  min-width: 0;
  height: 1.25rem;
  background: var(--color-superficie);
  border-radius: 999px;
  overflow: hidden;
}
.barra {
  display: block;
  height: 100%;
  background: var(--color-primario);
  border-radius: 999px;
}
.fila--destacada .barra {
  background: var(--color-advertencia);
}
</style>
