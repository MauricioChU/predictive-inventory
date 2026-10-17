<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Check, Pencil, Trash2, X } from 'lucide-vue-next'
import Boton from '@/shared/ui/componentes/Boton.vue'
import CampoTexto from '@/shared/ui/componentes/CampoTexto.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'

const props = withDefaults(
  defineProps<{
    nombre: string
    /** "3 productos", "Sin productos". */
    textoCantidad: string
    /** Se está cambiando el nombre (en esta misma fila). */
    editando: boolean
    /** v-model:nombreNuevo, lo escrito mientras se edita. */
    nombreNuevo: string
    errorNombre?: string
    /** RN-CAT-15: por qué no se pudo eliminar. */
    errorEliminar?: string
  }>(),
  { errorNombre: undefined, errorEliminar: undefined },
)
const emit = defineEmits<{
  editar: []
  guardar: []
  cancelar: []
  eliminar: []
  'update:nombreNuevo': [nombre: string]
}>()

const refFila = ref<HTMLElement>()

// Al abrir la edición el foco va al campo; al cerrarla (guardar o cancelar), vuelve a
// "Cambiar nombre": el foco nunca se pierde cuando su botón desaparece.
watch(
  () => props.editando,
  async (editando) => {
    await nextTick()
    const selector = editando ? 'input' : '.cambiar-nombre'
    refFila.value?.querySelector<HTMLElement>(selector)?.focus()
  },
)
</script>

<template>
  <div ref="refFila" class="categoria">
    <div class="fila-de-categoria">
      <form v-if="editando" class="edicion" novalidate @submit.prevent="emit('guardar')">
        <CampoTexto
          :model-value="nombreNuevo"
          :etiqueta="`Nuevo nombre para ${nombre}`"
          autocompletar="off"
          :error="errorNombre"
          @update:model-value="emit('update:nombreNuevo', $event)"
        />
        <div class="botones">
          <Boton tipo="submit" texto="Guardar nombre" variante="primario" :icono="Check" />
          <Boton texto="Cancelar" :icono="X" @click="emit('cancelar')" />
        </div>
      </form>

      <template v-else>
        <p class="datos">
          <span class="nombre">{{ nombre }}</span>
          <span class="cantidad">{{ textoCantidad }}</span>
        </p>
        <div class="botones">
          <Boton
            class="cambiar-nombre"
            texto="Cambiar nombre"
            :aria-label="`Cambiar nombre de ${nombre}`"
            :icono="Pencil"
            @click="emit('editar')"
          />
          <Boton
            texto="Eliminar"
            :aria-label="`Eliminar ${nombre}`"
            variante="peligro"
            :icono="Trash2"
            @click="emit('eliminar')"
          />
        </div>
      </template>
    </div>
    <!-- Fuera del recuadro de la fila y a todo el ancho: a 320 px con letra Muy grande no queda
         apretado dentro de su relleno. -->
    <MensajeDeError v-if="errorEliminar && !editando" :mensaje="errorEliminar" />
  </div>
</template>

<style scoped>
.fila-de-categoria {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--espacio-3);
  padding: var(--espacio-3);
  border-radius: var(--radio);
  background: var(--color-superficie);
}
.datos {
  display: grid;
  flex: 1 1 12rem;
  min-inline-size: 0;
  margin: 0;
}
.nombre {
  font-weight: 700;
}
.cantidad {
  color: var(--color-texto-suave);
}
.botones {
  display: flex;
  flex-wrap: wrap;
  gap: var(--separacion-toque);
}
.botones > * {
  flex: 1 1 auto;
}
.edicion {
  display: grid;
  gap: var(--espacio-3);
  inline-size: 100%;
}
.categoria {
  display: grid;
  gap: var(--espacio-2);
}
</style>
