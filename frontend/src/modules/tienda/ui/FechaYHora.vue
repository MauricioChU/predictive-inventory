<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

/**
 * Fecha y hora de la tienda bajo el saludo de Inicio ("lunes 19 de octubre" · "3:24 p. m."),
 * en America/Lima (UTC−5). Es solo para leer: no es una región en vivo (no se anuncia cada
 * minuto). Lee el reloj del celular (`new Date()`); es solo presentación, no una regla de negocio.
 */
const ZONA = 'America/Lima'
const FORMATO_DE_FECHA = new Intl.DateTimeFormat('es-PE', {
  timeZone: ZONA,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
const FORMATO_DE_HORA = new Intl.DateTimeFormat('es-PE', {
  timeZone: ZONA,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})
const CADA_MS = 30_000

/** Espacios normales (el formato usa espacios duros según el navegador) y sin la coma del día. */
function limpiar(texto: string): string {
  return texto.replace(/[\s\u00a0\u202f]+/g, ' ').replace(',', '')
}

function textoDeFecha(ahora: Date): string {
  return limpiar(FORMATO_DE_FECHA.format(ahora))
}
function textoDeHora(ahora: Date): string {
  return limpiar(FORMATO_DE_HORA.format(ahora))
}

const fecha = ref(textoDeFecha(new Date()))
const hora = ref(textoDeHora(new Date()))

const temporizador = setInterval(() => {
  const ahora = new Date()
  fecha.value = textoDeFecha(ahora)
  hora.value = textoDeHora(ahora)
}, CADA_MS)
onBeforeUnmount(() => clearInterval(temporizador))
</script>

<template>
  <p class="fecha-y-hora">
    <span class="fecha">{{ fecha }}</span>
    <span class="hora">{{ hora }}</span>
  </p>
</template>

<style scoped>
.fecha-y-hora {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--espacio-1) var(--espacio-4);
  margin: 0;
  color: var(--color-texto-suave);
  font-size: 1.125rem;
  font-weight: 700;
}
.hora {
  margin-left: auto;
  white-space: nowrap;
}
</style>
