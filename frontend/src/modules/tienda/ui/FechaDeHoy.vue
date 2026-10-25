<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * La fecha de la tienda bajo el encabezado de Inicio ("LUNES 19 DE OCTUBRE"), en America/Lima
 * (UTC−5), en mayúsculas y sin hora (el celular ya la muestra). Es solo para leer: no es una
 * región en vivo. Sin intervalo: si la app sigue abierta pasada la medianoche, la fecha se pone
 * al día cuando la pestaña vuelve a estar a la vista (`visibilitychange`). Lee el reloj del
 * celular (`new Date()`); es solo presentación, no una regla de negocio.
 */
const FORMATO_DE_FECHA = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/** Espacios normales (el formato usa espacios duros según el navegador), sin coma y en mayúsculas. */
function textoDeFecha(ahora: Date): string {
  return FORMATO_DE_FECHA.format(ahora)
    .replace(/[\s\u00a0\u202f]+/g, ' ')
    .replace(',', '')
    .toLocaleUpperCase('es')
}

const fecha = ref(textoDeFecha(new Date()))

function alVolverALaPantalla(): void {
  if (document.visibilityState === 'hidden') return
  fecha.value = textoDeFecha(new Date())
}

onMounted(() => document.addEventListener('visibilitychange', alVolverALaPantalla))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', alVolverALaPantalla))
</script>

<template>
  <p class="fecha-de-hoy">{{ fecha }}</p>
</template>

<style scoped>
.fecha-de-hoy {
  margin: 0;
  color: var(--color-texto-suave);
  font-size: 0.85rem;
  font-weight: 400;
  letter-spacing: 0.08em;
}
</style>
