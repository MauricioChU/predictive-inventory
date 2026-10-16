<script setup lang="ts">
import { useRouter } from 'vue-router'
import FormularioDeProducto from './FormularioDeProducto.vue'

defineProps<{ id: string }>()
const router = useRouter()
</script>

<template>
  <FormularioDeProducto
    :key="id"
    :producto-id="id"
    @agregar-otro="router.push({ name: 'producto-nuevo' })"
  />
</template>
