<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { Check, Pencil, Tag, Trash2 } from 'lucide-vue-next'
import type { Unidad } from '@/shared/domain/cantidad'
import { SIMBOLO_DE_UNIDAD } from '@/shared/domain/formato'
import Boton from './Boton.vue'
import CampoNumero from './CampoNumero.vue'
import FotoDeProducto from './FotoDeProducto.vue'

const props = withDefaults(
  defineProps<{
    nombre: string
    imagen?: Blob | string
    categoria?: string
    unidad: Unidad
    /** v-model:cantidad, tal como se escribe ("2", "1,5"). */
    cantidad: string
    /** "S/ 4.50 c/u" */
    textoPrecio: string
    /** "S/ 9.00" */
    textoImporte: string
    precioEditable?: boolean
    /** "Precio especial": marca que este precio no es el de siempre. */
    textoPrecioEspecial?: string
    /** Precio actual sin formato ("4.50") con el que arranca la edición en línea. */
    valorPrecio?: string
    /** En Recibir la línea lleva el costo en vez del precio de venta. */
    concepto?: 'precio' | 'costo'
  }>(),
  {
    imagen: undefined,
    categoria: undefined,
    precioEditable: false,
    textoPrecioEspecial: undefined,
    valorPrecio: undefined,
    concepto: 'precio',
  },
)
const emit = defineEmits<{
  'update:cantidad': [valor: string]
  /** Lo escrito en la edición en línea, sin validar: lo valida quien usa la fila. */
  cambiarPrecio: [precio: string]
  quitar: []
}>()

const id = useId()
const idNombre = `${id}-nombre`
const idEdicion = `${id}-edicion`

const porUnidades = computed(() => props.unidad === 'UNIDAD')
/** "−" nunca deja la línea en cero: por unidades no baja de 1; por kilo o litro, de lo que
 * sea mayor que 0 (para sacar el producto está "Quitar"). */
const minimo = computed(() => (porUnidades.value ? 1 : 0.001))

const TEXTOS = {
  precio: { cambiar: 'Cambiar precio', nuevo: 'Nuevo precio en S/', guardar: 'Guardar precio' },
  costo: { cambiar: 'Cambiar costo', nuevo: 'Nuevo costo en S/', guardar: 'Guardar costo' },
} as const
const textos = computed(() => TEXTOS[props.concepto])

const editando = ref(false)
const precioNuevo = ref('')
const refCambiar = ref<InstanceType<typeof Boton>>()
const refEdicion = ref<HTMLElement>()

function enfocarCambiar() {
  ;(refCambiar.value?.$el as HTMLElement | undefined)?.focus()
}

function alternarEdicion() {
  if (editando.value) {
    cerrarEdicion()
    return
  }
  precioNuevo.value = props.valorPrecio ?? ''
  editando.value = true
  // Se abre para escribir el precio: el foco va al campo (abre el teclado numérico a propósito).
  void nextTick(() => refEdicion.value?.querySelector('input')?.focus())
}

function cerrarEdicion() {
  // Primero el foco y después se cierra: el botón que tenía el foco desaparece.
  enfocarCambiar()
  editando.value = false
}

function guardar() {
  emit('cambiarPrecio', precioNuevo.value)
  cerrarEdicion()
}
</script>

<template>
  <div class="fila-de-carrito" role="group" :aria-labelledby="idNombre">
    <div class="cabecera">
      <FotoDeProducto
        :imagen="imagen"
        :nombre="nombre"
        :categoria="categoria"
        tamano="chica"
        decorativa
      />
      <div class="titulo">
        <p :id="idNombre" class="nombre">{{ nombre }}</p>
        <p class="precio">
          <span>{{ textoPrecio }}</span>
          <span v-if="textoPrecioEspecial" class="precio-especial">
            <Tag aria-hidden="true" class="icono-especial" />
            <span>{{ textoPrecioEspecial }}</span>
          </span>
        </p>
      </div>
    </div>

    <div class="cantidad-e-importe">
      <CampoNumero
        class="cantidad"
        etiqueta="Cantidad"
        :model-value="cantidad"
        :decimales="!porUnidades"
        :minimo="minimo"
        :sufijo="SIMBOLO_DE_UNIDAD[unidad]"
        @update:model-value="emit('update:cantidad', $event)"
      />
      <p class="importe">
        <span class="etiqueta-importe">Importe</span>
        <span class="valor-importe">{{ textoImporte }}</span>
      </p>
    </div>

    <!-- RN-UX-05: acciones a la vista, sin deslizar ni mantener presionado. El nombre accesible
         empieza con el texto visible (WCAG 2.5.3) y dice de qué producto es. -->
    <div class="acciones">
      <Boton
        v-if="precioEditable"
        ref="refCambiar"
        class="accion"
        :texto="textos.cambiar"
        :icono="Pencil"
        :aria-label="`${textos.cambiar} de ${nombre}`"
        :aria-expanded="editando ? 'true' : 'false'"
        :aria-controls="editando ? idEdicion : undefined"
        @click="alternarEdicion"
      />
      <Boton
        class="accion"
        texto="Quitar"
        variante="peligro"
        :icono="Trash2"
        :aria-label="`Quitar ${nombre}`"
        @click="emit('quitar')"
      />
    </div>

    <div
      v-if="editando"
      :id="idEdicion"
      ref="refEdicion"
      class="edicion-precio"
      @keydown.esc="cerrarEdicion"
    >
      <CampoNumero v-model="precioNuevo" :etiqueta="textos.nuevo" decimales />
      <div class="acciones">
        <Boton
          class="accion"
          :texto="textos.guardar"
          variante="primario"
          :icono="Check"
          @click="guardar"
        />
        <Boton class="accion" texto="Cancelar" @click="cerrarEdicion" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.fila-de-carrito {
  container-type: inline-size;
  display: grid;
  gap: var(--espacio-3);
  padding: var(--espacio-3);
  border: 1px solid var(--color-borde);
  border-radius: var(--radio);
  background: var(--color-fondo);
}
.cabecera {
  display: flex;
  align-items: flex-start;
  gap: var(--espacio-3);
}
.titulo {
  min-inline-size: 0;
}
.nombre {
  margin: 0;
  font-weight: 700;
  line-height: 1.25;
  overflow-wrap: break-word;
}
.precio {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--espacio-1) var(--espacio-2);
  margin: var(--espacio-1) 0 0;
  color: var(--color-texto-suave);
}
.precio-especial {
  display: inline-flex;
  align-items: center;
  gap: var(--espacio-1);
  padding: 0 var(--espacio-2);
  border: 1px solid var(--color-advertencia);
  border-radius: 999px;
  background: var(--color-advertencia-suave);
  color: var(--color-advertencia);
  font-size: 0.9rem;
  font-weight: 700;
}
.icono-especial {
  inline-size: 1.1em;
  block-size: 1.1em;
  flex: none;
}
.cantidad-e-importe {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--espacio-3);
}
.cantidad {
  flex: 1 1 12rem;
  min-inline-size: 0;
}
.importe {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin: 0 0 0 auto;
  text-align: end;
}
.etiqueta-importe {
  color: var(--color-texto-suave);
  font-size: 0.9rem;
}
.valor-importe {
  font-size: 1.3rem;
  font-weight: 700;
  white-space: nowrap;
}
.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: var(--separacion-toque);
}
.accion {
  flex: 1 1 auto;
}
.edicion-precio {
  display: grid;
  gap: var(--espacio-3);
  padding: var(--espacio-3);
  border-radius: var(--radio-chico);
  background: var(--color-primario-suave);
}
</style>
