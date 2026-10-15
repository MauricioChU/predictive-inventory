<!-- eslint-disable vue/multi-word-component-names -- nombre exigido por el plan ("Tarjeta") -->
<script setup lang="ts">
withDefaults(defineProps<{ comoBoton?: boolean }>(), { comoBoton: false })
const emit = defineEmits<{ click: [evento: MouseEvent] }>()
</script>

<template>
  <component
    :is="comoBoton ? 'button' : 'div'"
    class="tarjeta"
    :type="comoBoton ? 'button' : undefined"
    @click="comoBoton ? emit('click', $event) : undefined"
  >
    <slot />
  </component>
</template>

<style scoped>
.tarjeta {
  display: block;
  width: 100%;
  background: var(--color-superficie);
  border-radius: var(--radio);
  padding: var(--espacio-4);
  text-align: left;
  border: none;
  font: inherit;
  color: inherit;
}
button.tarjeta {
  cursor: pointer;
}
button.tarjeta:hover {
  background: var(--color-primario-suave);
}
</style>
