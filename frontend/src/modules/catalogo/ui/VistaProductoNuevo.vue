<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FormularioDeProducto from './FormularioDeProducto.vue'

const route = useRoute()
const router = useRouter()

/** Cambia para empezar un formulario nuevo y vacío ("Agregar otro producto"). */
const vez = ref(0)
/** `?nombre=` lo pone la lista al no encontrar lo que se buscó. */
const nombreInicial = computed(() =>
  typeof route.query.nombre === 'string' ? route.query.nombre : '',
)

/** `?desde=primera-vez` (plan 14): se carga uno por uno y al guardar se ofrece "Seguir". */
const desdePrimeraVez = computed(() => route.query.desde === 'primera-vez')

/** El nombre de la búsqueda era para el primero; "desde" sigue (el mismo recorrido). */
async function agregarOtro() {
  if (route.query.nombre !== undefined) {
    const resto = Object.fromEntries(
      Object.entries(route.query).filter(([clave]) => clave !== 'nombre'),
    )
    await router.replace({ name: 'producto-nuevo', query: resto })
  }
  vez.value += 1
}
</script>

<template>
  <FormularioDeProducto
    :key="vez"
    :nombre-inicial="nombreInicial"
    :desde-primera-vez="desdePrimeraVez"
    @agregar-otro="agregarOtro"
  />
</template>
