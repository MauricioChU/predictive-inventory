<script setup lang="ts">
withDefaults(defineProps<{ titulo: string; descripcion?: string; accion?: string }>(), {
  descripcion: undefined,
  accion: undefined,
})
const emit = defineEmits<{ accion: [] }>()
</script>

<template>
  <!-- Q2: es contenido estático normal de la página (no un aviso que aparece de golpe),
       así que no lleva role="status": ese rol es para regiones vivas que cambian; aquí
       alcanza con que el lector de pantalla lo lea en el orden normal del documento. -->
  <div class="estado-vacio">
    <p class="titulo">{{ titulo }}</p>
    <p v-if="descripcion" class="descripcion">{{ descripcion }}</p>
    <button v-if="accion" type="button" class="accion" @click="emit('accion')">
      {{ accion }}
    </button>
  </div>
</template>

<style scoped>
.estado-vacio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--espacio-3);
  padding: var(--espacio-6) var(--espacio-4);
  text-align: center;
  color: var(--color-texto-suave);
}
.titulo {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-texto);
  margin: 0;
}
.descripcion {
  margin: 0;
}
.accion {
  min-height: var(--alto-toque);
  padding-inline: var(--espacio-5);
  border: 2px solid var(--color-primario);
  border-radius: var(--radio-chico);
  background: var(--color-primario-suave);
  color: var(--color-primario);
  font-weight: 700;
  cursor: pointer;
}
</style>
