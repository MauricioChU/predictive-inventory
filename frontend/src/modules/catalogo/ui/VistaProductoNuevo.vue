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

async function agregarOtro() {
  if (route.query.nombre !== undefined) await router.replace({ name: 'producto-nuevo' })
  vez.value += 1
}
</script>

<template>
  <FormularioDeProducto :key="vez" :nombre-inicial="nombreInicial" @agregar-otro="agregarOtro" />
</template>
