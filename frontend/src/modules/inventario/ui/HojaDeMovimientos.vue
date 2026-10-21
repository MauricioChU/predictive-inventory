<script setup lang="ts">
import { computed, ref } from 'vue'
import { hoyEnLaTienda, sumarDias, type Dia } from '@/shared/domain/fecha'
import HojaInferior from '@/shared/ui/componentes/HojaInferior.vue'
import SelectorSegmentado from '@/shared/ui/componentes/SelectorSegmentado.vue'
import ListaDeMovimientos from './ListaDeMovimientos.vue'

/**
 * «Movimientos» (06-experiencia-de-uso, Inicio): el historial de días en una hoja inferior, con
 * filtros de fecha en vez de por tipo: Hoy · Ayer · 7 días · 30 días · Elegir día.
 */
defineProps<{ volverA?: HTMLElement | null }>()
const emit = defineEmits<{ cerrar: [] }>()

type FiltroDeFecha = 'HOY' | 'AYER' | 'SIETE' | 'TREINTA' | 'ELEGIR'
const OPCIONES: readonly { valor: FiltroDeFecha; etiqueta: string }[] = [
  { valor: 'HOY', etiqueta: 'Hoy' },
  { valor: 'AYER', etiqueta: 'Ayer' },
  { valor: 'SIETE', etiqueta: '7 días' },
  { valor: 'TREINTA', etiqueta: '30 días' },
  { valor: 'ELEGIR', etiqueta: 'Elegir día' },
]

const hoy: Dia = hoyEnLaTienda(new Date())
const filtro = ref<FiltroDeFecha>('SIETE')
/** El día elegido con «Elegir día» (AAAA-MM-DD); vacío mientras no se elija. */
const elegido = ref('')

const rango = computed<{ desde: Dia; hasta: Dia } | null>(() => {
  switch (filtro.value) {
    case 'HOY':
      return { desde: hoy, hasta: hoy }
    case 'AYER':
      return { desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, -1) }
    case 'SIETE':
      return { desde: sumarDias(hoy, -6), hasta: hoy }
    case 'TREINTA':
      return { desde: sumarDias(hoy, -29), hasta: hoy }
    default:
      return elegido.value ? { desde: elegido.value, hasta: elegido.value } : null
  }
})

const vacio = {
  titulo: 'No hay movimientos en estos días',
  descripcion: 'Prueba con otras fechas.',
}
</script>

<template>
  <HojaInferior titulo="Movimientos" :volver-a="volverA" @cerrar="emit('cerrar')">
    <div class="movimientos">
      <SelectorSegmentado v-model="filtro" :opciones="OPCIONES" etiqueta="Fecha" etiqueta-oculta />
      <label v-if="filtro === 'ELEGIR'" class="elegir">
        <span class="etiqueta">¿Qué día?</span>
        <input v-model="elegido" type="date" class="dia" :max="hoy" />
      </label>
      <p v-if="filtro === 'ELEGIR' && !rango" class="pista">Elige un día para verlo.</p>
      <ListaDeMovimientos v-else :rango="rango" :vacio="vacio" :nivel-encabezado="3" />
    </div>
  </HojaInferior>
</template>

<style scoped>
.movimientos {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-4);
}
.elegir {
  display: grid;
  gap: var(--espacio-2);
}
.etiqueta {
  font-weight: 700;
}
.dia {
  min-block-size: var(--alto-boton-principal);
  padding-inline: var(--espacio-3);
  border: 2px solid var(--color-borde);
  border-radius: var(--radio-chico);
  background: var(--color-fondo);
  color: var(--color-texto);
  font: inherit;
  font-size: 1.125rem;
}
.pista {
  margin: 0;
  color: var(--color-texto-suave);
}
</style>
