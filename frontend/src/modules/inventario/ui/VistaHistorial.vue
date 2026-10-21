<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import SelectorSegmentado from '@/shared/ui/componentes/SelectorSegmentado.vue'
import ListaDeMovimientos from './ListaDeMovimientos.vue'
import { FILTROS_DEL_HISTORIAL, type FiltroDeTipo } from './presentacion-de-operaciones'

/**
 * Historial (HU-OP-08; 06-experiencia-de-uso): todo lo que pasó, agrupado por día ("Hoy",
 * "Ayer", "Lunes 12"), lo más nuevo primero y con filtro por tipo. Tocar una operación abre su
 * detalle, donde se puede anular. Desde Inicio, «Movimientos» muestra esta misma lista en una
 * hoja, con filtros de fecha; esta pantalla sigue para los enlaces que llegan aquí.
 */
const router = useRouter()
const filtro = ref<FiltroDeTipo>('TODO')

const vacio = computed(() =>
  filtro.value === 'TODO'
    ? {
        titulo: 'Todavía no hay nada en el historial',
        descripcion: 'Aquí verás cada venta, llegada de mercadería, pérdida y conteo.',
        accion: 'Hacer una venta',
      }
    : {
        titulo: 'No hay movimientos de este tipo',
        descripcion: 'Elige «Todo» para verlos todos.',
        accion: 'Ver todo',
      },
)

function alAccionDelVacio(): void {
  if (filtro.value === 'TODO') void router.push({ name: 'vender' })
  else filtro.value = 'TODO'
}
</script>

<template>
  <div class="vista-historial">
    <EncabezadoPagina titulo="Historial" volver />
    <SelectorSegmentado
      v-model="filtro"
      class="filtro"
      :opciones="FILTROS_DEL_HISTORIAL"
      etiqueta="Mostrar"
    />
    <ListaDeMovimientos :tipo="filtro" :vacio="vacio" @accion="alAccionDelVacio" />
  </div>
</template>

<style scoped>
.vista-historial {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-5);
  max-inline-size: 48rem;
}
</style>
