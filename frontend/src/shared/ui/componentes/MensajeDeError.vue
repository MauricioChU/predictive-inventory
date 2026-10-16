<script setup lang="ts">
import { CircleAlert } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    /** El mensaje del dominio, tal cual: "Solo quedan 2 unid. de Lejía 1 L." (RN-UX-07). */
    mensaje: string
    /** Qué hacer: "Cambia la cantidad o registra la llegada de mercadería." */
    ayuda?: string
  }>(),
  { ayuda: undefined },
)
</script>

<template>
  <div class="mensaje-de-error" role="alert">
    <!-- role="alert": aparece por algo que la persona acaba de hacer y debe oírlo en el acto.
         Los atributos (p. ej. un id para el aria-describedby de un campo) pasan a esta caja. -->
    <CircleAlert aria-hidden="true" class="icono" />
    <div class="textos">
      <p class="mensaje">{{ mensaje }}</p>
      <p v-if="ayuda" class="ayuda">{{ ayuda }}</p>
    </div>
  </div>
</template>

<style scoped>
.mensaje-de-error {
  display: flex;
  align-items: flex-start;
  gap: var(--espacio-3);
  padding: var(--espacio-4);
  border: 2px solid var(--color-peligro);
  border-left-width: 8px;
  border-radius: var(--radio);
  background: var(--color-peligro-suave);
  overflow-wrap: break-word;
}
.icono {
  width: 1.75rem;
  height: 1.75rem;
  min-width: 24px;
  min-height: 24px;
  flex: none;
  color: var(--color-peligro);
}
.textos {
  flex: 1;
  min-width: 0;
}
.mensaje {
  margin: 0;
  font-weight: 700;
  color: var(--color-peligro);
}
.ayuda {
  margin: var(--espacio-1) 0 0;
  color: var(--color-texto);
}
</style>
