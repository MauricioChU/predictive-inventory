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
    /** RN-OP-22 (solo Vender): "Quedan 7 unid." o "Se acaba" tras la venta. */
    textoQuedan?: string
    /** Nombre del monto de la línea: "Importe" (Vender), "Costo estimado" (Para comprar). */
    etiquetaImporte?: string
    precioEditable?: boolean
    /** "Precio especial": marca que este precio no es el de siempre. */
    textoPrecioEspecial?: string
    /** Precio actual sin formato ("4.50") con el que arranca la edición en línea. */
    valorPrecio?: string
    /** En Recibir la línea lleva el costo en vez del precio de venta. */
    concepto?: 'precio' | 'costo'
    /** RN-UX-07 / RN-OP-04: qué pasó con la cantidad y qué hacer ("Solo quedan 2 unid. de
     * Lejía 1 L. Cambia la cantidad o registra la llegada de mercadería."), junto al campo. */
    errorCantidad?: string
    /**
     * Error del precio escrito en la edición en línea, junto a ese campo. Contrato: al guardar
     * (botón o Enter) la fila emite `cambiarPrecio(texto)` y espera un nextTick; si para
     * entonces hay `errorPrecio`, la edición queda abierta con lo escrito y el foco en el campo;
     * si no, se cierra. Por eso la pantalla debe validar SINCRÓNICAMENTE en su handler de
     * `cambiarPrecio` (leer el texto con el dominio es sincrónico) y fijar o borrar este error
     * ahí mismo, sin await antes. Al cancelar, la fila emite `cancelarPrecio`: la pantalla
     * borra el error para que no aparezca viejo la próxima vez.
     */
    errorPrecio?: string
    /**
     * RN-OP-22: la forma compacta del panel de venta en celular, para ver 2–3 líneas a la vez:
     * nombre y cuánto queda arriba; − / + con el importe (y el precio por unidad) al lado; y
     * Cambiar precio y Quitar en una sola fila. Las etiquetas "Cantidad (unid.)" e "Importe"
     * quedan para el lector de pantalla. Los toques siguen de 48 px o más.
     */
    compacta?: boolean
  }>(),
  {
    imagen: undefined,
    categoria: undefined,
    precioEditable: false,
    textoPrecioEspecial: undefined,
    valorPrecio: undefined,
    concepto: 'precio',
    etiquetaImporte: 'Importe',
    textoQuedan: undefined,
    errorCantidad: undefined,
    errorPrecio: undefined,
    compacta: false,
  },
)
const emit = defineEmits<{
  'update:cantidad': [valor: string]
  /** Lo escrito en la edición en línea, sin validar: lo valida quien usa la fila (ver
   * errorPrecio). */
  cambiarPrecio: [precio: string]
  /** Se cerró la edición sin guardar (Cancelar, Escape o "Cambiar precio" otra vez). */
  cancelarPrecio: []
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
    cancelar()
    return
  }
  precioNuevo.value = props.valorPrecio ?? ''
  editando.value = true
  // Se abre para escribir el precio: el foco va al campo (abre el teclado numérico a propósito).
  void nextTick(() => refEdicion.value?.querySelector('input')?.focus())
}

function enfocarCampoDePrecio() {
  refEdicion.value?.querySelector('input')?.focus()
}

function cerrarEdicion() {
  // Primero el foco y después se cierra: el botón que tenía el foco desaparece.
  enfocarCambiar()
  editando.value = false
}

function cancelar() {
  cerrarEdicion()
  emit('cancelarPrecio')
}

/** Ronda 1: emite y, ya con la respuesta de la pantalla (errorPrecio), decide si cerrar. */
async function guardar() {
  emit('cambiarPrecio', precioNuevo.value)
  await nextTick()
  if (props.errorPrecio) {
    // Precio inválido: queda abierta con lo escrito para corregirlo; el error ya se ve y se
    // anuncia (role="alert" de CampoNumero).
    enfocarCampoDePrecio()
    return
  }
  cerrarEdicion()
}

/** Enter en el campo (la tecla "Ir" del teclado numérico) guarda. En un botón, Enter ya lo
 * activa con su propio click: no se guarda dos veces ni se guarda al tocar "Cancelar". */
function alPresionarEnter(evento: KeyboardEvent) {
  if (!(evento.target instanceof HTMLInputElement)) return
  evento.preventDefault()
  void guardar()
}
</script>

<template>
  <div
    class="fila-de-carrito"
    :class="{ 'fila-de-carrito--compacta': compacta }"
    role="group"
    :aria-labelledby="idNombre"
  >
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
        <!-- Compacta: el precio por unidad va debajo del importe; aquí solo la marca. -->
        <p v-if="!compacta || textoPrecioEspecial" class="precio">
          <span v-if="!compacta">{{ textoPrecio }}</span>
          <span v-if="textoPrecioEspecial" class="precio-especial">
            <Tag aria-hidden="true" class="icono-especial" />
            <span>{{ textoPrecioEspecial }}</span>
          </span>
        </p>
        <p
          v-if="textoQuedan"
          class="quedan"
          :class="{ 'quedan--acaba': textoQuedan === 'Se acaba' }"
        >
          {{ textoQuedan }}
        </p>
      </div>
    </div>

    <div class="cantidad-e-importe">
      <!-- La unidad va en la etiqueta ("Cantidad (kg)") y no como sufijo junto al número: a
           320 px con letra Muy grande el sufijo dejaba el campo en ~34 px de ancho. -->
      <CampoNumero
        class="cantidad"
        :etiqueta="`Cantidad (${SIMBOLO_DE_UNIDAD[unidad]})`"
        :model-value="cantidad"
        :decimales="!porUnidades"
        :minimo="minimo"
        :error="errorCantidad"
        :etiqueta-oculta="compacta"
        @update:model-value="emit('update:cantidad', $event)"
      />
      <p class="importe">
        <span class="etiqueta-importe" :class="{ 'solo-lector': compacta }">{{
          etiquetaImporte
        }}</span>
        <span class="valor-importe">{{ textoImporte }}</span>
        <span v-if="compacta" class="precio-unitario">{{ textoPrecio }}</span>
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

    <!-- Escape cierra solo esta edición (.stop): no llega al panel de venta, que con Escape se
         cerraría entero. -->
    <div
      v-if="editando"
      :id="idEdicion"
      ref="refEdicion"
      class="edicion-precio"
      @keydown.esc.stop="cancelar"
      @keydown.enter="alPresionarEnter"
    >
      <CampoNumero v-model="precioNuevo" :etiqueta="textos.nuevo" decimales :error="errorPrecio" />
      <div class="acciones">
        <Boton
          class="accion"
          :texto="textos.guardar"
          variante="primario"
          :icono="Check"
          @click="guardar"
        />
        <Boton class="accion" texto="Cancelar" @click="cancelar" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.fila-de-carrito {
  container-type: inline-size;
  display: grid;
  /* minmax(0, 1fr), no la columna implícita "auto": esa crece hasta el ancho mínimo de su
     contenido y la fila se salía 200 px de la pantalla en 320 px (como S1 en la navegación). */
  grid-template-columns: minmax(0, 1fr);
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
.quedan {
  margin: var(--espacio-1) 0 0;
  color: var(--color-texto-suave);
  font-size: 0.95rem;
  font-weight: 700;
}
/* "Se acaba" también va en negrita y con el texto: el color no es la única señal. */
.quedan--acaba {
  color: var(--color-advertencia);
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
  /* En PC no se estira a todo el ancho: un número corto en un campo de 900 px se pierde. */
  max-inline-size: 22rem;
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
  /* En PC un "Quitar" solo no se vuelve una franja roja de 900 px. */
  max-inline-size: 20rem;
}
.edicion-precio {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-3);
  padding: var(--espacio-3);
  border-radius: var(--radio-chico);
  background: var(--color-primario-suave);
}
/* Fila angosta (320–360 px con letra Muy grande): menos relleno a los costados de la edición,
   para que el campo del precio tenga lugar para "12.50". */
@container (max-width: 13rem) {
  .edicion-precio {
    padding-inline: var(--espacio-2);
    margin-inline: calc(-1 * var(--espacio-1));
  }
}

/* RN-OP-22 — forma compacta (panel de venta en celular). Tres filas: foto, nombre y cuánto
   queda; − / + con el importe y el precio por unidad a la derecha (si no entra, el importe baja
   a su propia fila); Cambiar precio y Quitar lado a lado. Sin caja propia (la lista las separa
   con una raya): todo el ancho de la hoja es para la línea. Toques de 48 px o más (RN-UX-02). */
.fila-de-carrito--compacta {
  gap: var(--espacio-2);
  padding: var(--espacio-3) 0;
  border: none;
  border-radius: 0;
  background: none;
}
.fila-de-carrito--compacta .quedan {
  margin-block-start: 2px;
  font-size: 1rem;
}
.fila-de-carrito--compacta .cantidad-e-importe {
  align-items: center;
  gap: var(--espacio-2) var(--espacio-3);
}
/* El campo se reparte en la fila: − / cantidad / + a la izquierda y su error, si hay, debajo a
   todo el ancho (no en una columna angosta junto al importe). */
.fila-de-carrito--compacta .cantidad {
  display: contents;
}
.fila-de-carrito--compacta .cantidad :deep(.fila) {
  flex: 0 1 auto;
  min-inline-size: 0;
}
.fila-de-carrito--compacta .cantidad :deep(input) {
  flex: 0 1 3.5rem;
  inline-size: 3.5rem;
  min-inline-size: 2.75rem;
}
.fila-de-carrito--compacta .cantidad :deep(.error) {
  order: 1;
  flex: 1 0 100%;
  margin: 0;
}
.fila-de-carrito--compacta .importe {
  line-height: 1.2;
}
.fila-de-carrito--compacta .valor-importe {
  font-size: 1.2rem;
}
.precio-unitario {
  color: var(--color-texto-suave);
  font-size: 0.875rem;
  white-space: nowrap;
}
.fila-de-carrito--compacta .acciones {
  justify-content: space-between;
}
.fila-de-carrito--compacta .acciones .accion {
  flex: 0 1 auto;
  gap: var(--espacio-1);
  padding-inline: var(--espacio-2);
  font-size: 0.9rem;
}
</style>
