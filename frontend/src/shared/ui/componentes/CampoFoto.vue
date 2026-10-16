<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Camera, Images, Trash2 } from 'lucide-vue-next'
import Boton from './Boton.vue'
import FotoDeProducto from './FotoDeProducto.vue'

const props = withDefaults(
  defineProps<{
    /** v-model: la foto elegida tal cual (la reduce quien lo usa), o null si no hay. Quien lo
     * usa lo actualiza en el mismo handler de `update:modelValue` (sincrónico): así, al quitar
     * la foto, el foco pasa a "Tomar foto" antes de que desaparezca "Quitar foto". */
    modelValue?: Blob | null
    /** "Foto del producto" */
    etiqueta: string
    /** Nombre del producto: texto alternativo de la vista previa. */
    nombre?: string
    /** Para el ícono de la vista previa vacía. */
    categoria?: string
  }>(),
  { modelValue: null, nombre: undefined, categoria: undefined },
)
const emit = defineEmits<{ 'update:modelValue': [foto: Blob | null]; error: [mensaje: string] }>()

const MENSAJE_NO_ES_FOTO =
  'Ese archivo no es una foto. Elige una foto de la galería o toma una nueva.'

const refCamara = ref<HTMLInputElement>()
const refGaleria = ref<HTMLInputElement>()
const refTomarFoto = ref<InstanceType<typeof Boton>>()
/** "Quitar foto" tenía el foco: al desaparecer, el foco no debe perderse. */
let devolverFoco = false

function alElegir(evento: Event) {
  const input = evento.target as HTMLInputElement
  const archivo = input.files?.[0]
  // Se vacía para que elegir otra vez el mismo archivo también dispare "change".
  input.value = ''
  if (!archivo) return // cerró la cámara o la galería sin elegir nada
  // Ronda 1: un tipo vacío NO es "no es foto": algunos celulares no lo informan (p. ej. HEIC).
  // Se acepta y, si de verdad no es una imagen, lo dirá quien la procesa (decodificar/reducir).
  if (archivo.type !== '' && !archivo.type.startsWith('image/')) {
    emit('error', MENSAJE_NO_ES_FOTO)
    return
  }
  emit('update:modelValue', archivo)
}

function quitar() {
  devolverFoco = true
  emit('update:modelValue', null)
  // Ronda 1: el pedido vale solo para ESTE cambio. Si la pantalla lo atiende, el watcher corre
  // antes de este nextTick; si no lo atiende, la marca se borra igual y un null posterior (otro
  // producto sin foto, mucho después) no se lleva el foco.
  void nextTick(() => {
    devolverFoco = false
  })
}

// Corre antes de que Vue saque "Quitar foto" del DOM ("Tomar foto" siempre está): el foco pasa
// directo, sin quedar un instante en <body>. Solo si de verdad se quitó (quien lo usa podría no
// aceptar el cambio).
watch(
  () => props.modelValue,
  (foto) => {
    const pedido = devolverFoco
    devolverFoco = false // se consume en cada cambio, se haya quitado o no
    if (foto || !pedido) return
    ;(refTomarFoto.value?.$el as HTMLElement | undefined)?.focus()
  },
)
</script>

<template>
  <fieldset class="campo-foto">
    <legend class="etiqueta">{{ etiqueta }}</legend>

    <div class="vista">
      <FotoDeProducto
        class="previa"
        :imagen="modelValue ?? undefined"
        :nombre="nombre ?? etiqueta"
        :categoria="categoria"
        tamano="grande"
        :decorativa="!modelValue"
      />
      <p v-if="!modelValue" class="sin-foto">Todavía no tiene foto</p>
    </div>

    <div class="acciones">
      <Boton
        ref="refTomarFoto"
        class="accion"
        texto="Tomar foto"
        variante="primario"
        :icono="Camera"
        @click="refCamara?.click()"
      />
      <Boton
        class="accion"
        texto="Elegir de la galería"
        :icono="Images"
        @click="refGaleria?.click()"
      />
      <Boton
        v-if="modelValue"
        class="accion"
        texto="Quitar foto"
        variante="peligro"
        :icono="Trash2"
        @click="quitar"
      />
    </div>

    <!-- Los <input type="file"> nativos son chicos y en inglés: quedan ocultos y fuera del
         foco; los abren los botones grandes de arriba. -->
    <input
      ref="refCamara"
      type="file"
      accept="image/*"
      capture="environment"
      class="oculto"
      tabindex="-1"
      aria-hidden="true"
      @change="alElegir"
    />
    <input
      ref="refGaleria"
      type="file"
      accept="image/*"
      class="oculto"
      tabindex="-1"
      aria-hidden="true"
      @change="alElegir"
    />
  </fieldset>
</template>

<style scoped>
.campo-foto {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-3);
  min-inline-size: 0;
  margin: 0;
  padding: 0;
  border: none;
}
.etiqueta {
  padding: 0;
  margin-bottom: var(--espacio-2);
  font-weight: 700;
}
.vista {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--espacio-3);
}
.previa {
  --foto-lado: min(100%, 12rem);
}
.sin-foto {
  margin: 0;
  color: var(--color-texto-suave);
}
.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: var(--separacion-toque);
}
.accion {
  flex: 1 1 auto;
}
.oculto {
  display: none;
}
</style>
