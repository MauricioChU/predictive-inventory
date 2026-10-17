<script setup lang="ts">
import { CircleAlert } from 'lucide-vue-next'
import { pegarCifras } from '../texto-sin-cortes'

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
         Los atributos (p. ej. un id para el aria-describedby de un campo) pasan a esta caja.
         Las mismas palabras del dominio; solo los espacios de "2 unid." o "1 L" no cortan. -->
    <div class="cuerpo">
      <CircleAlert aria-hidden="true" class="icono" />
      <p class="mensaje">{{ pegarCifras(mensaje) }}</p>
      <p v-if="ayuda" class="ayuda">{{ pegarCifras(ayuda) }}</p>
    </div>
  </div>
</template>

<style scoped>
.mensaje-de-error {
  /* Ocupa el ancho de su contenedor (con container-type, sin ancho propio colapsaría en un
     flex o grid que se ajusta a su contenido). */
  inline-size: 100%;
  container-type: inline-size;
  padding: var(--espacio-3);
  border: 2px solid var(--color-peligro);
  border-left-width: 6px;
  border-radius: var(--radio);
  background: var(--color-peligro-suave);
  overflow-wrap: break-word;
}
/* Ícono · mensaje arriba; la ayuda debajo del mensaje (o a todo el ancho si es angosto). */
.cuerpo {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--espacio-1) var(--espacio-3);
}
.icono {
  width: 1.75rem;
  height: 1.75rem;
  min-width: 24px;
  min-height: 24px;
  color: var(--color-peligro);
}
.mensaje {
  margin: 0;
  font-weight: 700;
  color: var(--color-peligro);
}
.ayuda {
  grid-column: 2;
  margin: 0;
  color: var(--color-texto);
}
@container (max-width: 24rem) {
  .ayuda {
    grid-column: 1 / -1;
  }
}
</style>
