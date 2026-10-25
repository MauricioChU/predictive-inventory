<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { ProductoVista } from '@/modules/catalogo'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { Cantidad } from '@/shared/domain/cantidad'
import type { Dinero } from '@/shared/domain/dinero'
import { formatearDinero } from '@/shared/domain/formato'
import { useAnunciador } from '@/shared/ui/anunciador'
import DialogoConfirmacion from '@/shared/ui/componentes/DialogoConfirmacion.vue'
import FilaDeCarrito from '@/shared/ui/componentes/FilaDeCarrito.vue'
import { textoDePrecio, type CarritoDePantalla, type Concepto } from './carrito-de-pantalla'
import { enfocarTitulo } from './foco-y-respuesta'
import { usarFotos } from './usar-fotos'

/**
 * Las líneas del carrito (Vender) o de lo que llegó (Llegó mercadería): − / + grandes, precio
 * especial o costo editable en la misma línea y Quitar. Los errores van junto a su campo
 * (RN-UX-07): los calcula el carrito con las reglas del dominio.
 */
const props = defineProps<{
  carrito: CarritoDePantalla
  concepto: Concepto
  /** "Toca un producto para agregarlo.": lo que se ve sin líneas (RN-UX-10). */
  textoVacio: string
  /** RN-OP-22: líneas compactas (el panel de venta en celular, ver FilaDeCarrito). */
  compacta?: boolean
}>()

const fotos = usarFotos()
const anunciador = useAnunciador()
const aplicacion = useAplicacion()
const refRaiz = ref<HTMLElement>()

/**
 * El botón Quitar desaparece con su línea: el foco va al título del carrito (no se pierde). Si era
 * la última línea del panel de venta, el panel baja y desaparece: el foco va al título de la
 * pantalla.
 */
async function quitar(lineaId: string, nombre: string): Promise<void> {
  const contenedor = refRaiz.value?.closest<HTMLElement>('.columna-carrito, .panel-de-venta')
  props.carrito.quitar(lineaId)
  anunciador.anunciar(`Quitaste ${nombre}`)
  await nextTick()
  if (props.carrito.vacio.value && contenedor?.classList.contains('panel-de-venta')) {
    await enfocarTitulo()
    return
  }
  contenedor?.querySelector<HTMLElement>('.titulo-carrito')?.focus()
}
const lineas = computed(() => props.carrito.lineas.value)
watch(
  () => lineas.value.map((l) => l.producto),
  (productos) => void fotos.cargar(productos),
  { immediate: true },
)

const UNA = Cantidad.deEntero(1)
/** RN-OP-11: al vender, se puede vender alguna (o la única) a otro precio. Solo desde la línea
 * con el precio de siempre (las de precio especial ya son la parte separada). */
function sePuedePartir(linea: (typeof lineas.value)[number]): boolean {
  return (
    esVenta.value && !linea.precioCambiado && (linea.cantidadLeida?.mayorOIgualQue(UNA) ?? false)
  )
}

/**
 * Solo al vender: el lápiz del precio cambia el precio del PRODUCTO para siempre (catálogo), no
 * solo el de esta venta (RN-OP-11; «¿Vendiste alguno a otro precio?» es lo que vale para esta
 * venta). Antes de guardar se pregunta; si el precio nuevo deja pérdida (RN-CAT-05), el caso de uso
 * del catálogo lo pide y se confirma otra vez. En Llegó mercadería el lápiz de costo no cambia.
 */
interface CambioDePrecio {
  lineaId: string
  producto: ProductoVista
  antes: Dinero
  nuevo: Dinero
}
const cambio = ref<CambioDePrecio | null>(null)
/** Mensaje de pérdida del catálogo (RN-CAT-05) mientras se espera la segunda confirmación. */
const perdida = ref<string | null>(null)
const guardandoPrecio = ref(false)

function pedirCambioDePrecio(linea: (typeof lineas.value)[number], texto: string): void {
  const nuevo = props.carrito.leerPrecioDelProducto(linea.id, texto)
  if (!nuevo) return
  if (nuevo.igualA(linea.producto.precioVenta)) {
    // Una línea con precio especial vuelve al precio de siempre (se junta con la normal); si ya
    // está al precio de siempre, no hay nada que cambiar y se dice.
    if (linea.precioCambiado) props.carrito.cambiarPrecio(linea.id, texto)
    else anunciador.anunciar('Ya se vende a ese precio')
    return
  }
  cambio.value = {
    lineaId: linea.id,
    producto: linea.producto,
    antes: linea.producto.precioVenta,
    nuevo,
  }
}

function cancelarCambioDePrecio(): void {
  cambio.value = null
  perdida.value = null
}

async function confirmarCambioDePrecio(confirmado: boolean): Promise<void> {
  const pedido = cambio.value
  if (!pedido || guardandoPrecio.value) return
  guardandoPrecio.value = true
  try {
    const respuesta = await aplicacion.catalogo.editarProducto({
      productoId: pedido.producto.id,
      precioVenta: textoDePrecio(pedido.nuevo),
      confirmado,
    })
    if (respuesta.tipo === 'confirmar') {
      perdida.value = respuesta.mensaje
      return
    }
    const actual = await aplicacion.catalogo.obtenerProducto(pedido.producto.id)
    if (actual) {
      props.carrito.aplicarPrecioDelProducto(pedido.lineaId, actual, pedido.antes)
      anunciador.anunciar(
        `${pedido.producto.nombre} ahora se vende a ${formatearDinero(pedido.nuevo)}`,
      )
    }
    cancelarCambioDePrecio()
  } catch (error) {
    console.error('No se pudo cambiar el precio del producto:', error)
    anunciador.anunciar('No pudimos cambiar el precio. Intenta otra vez.')
    cancelarCambioDePrecio()
  } finally {
    guardandoPrecio.value = false
  }
}

const POR_UNIDAD = { UNIDAD: 'c/u', KILO: 'el kg', LITRO: 'el L' } as const
const esVenta = computed(() => props.concepto === 'venta')

function textoPrecio(linea: (typeof lineas.value)[number]): string {
  const precio = `${formatearDinero(linea.precio)} ${POR_UNIDAD[linea.producto.unidad]}`
  return esVenta.value ? precio : `Costo ${precio}`
}
</script>

<template>
  <div ref="refRaiz" class="lista-del-carrito">
    <p v-if="lineas.length === 0" class="vacio">{{ textoVacio }}</p>
    <!-- Al quitar una línea se desvanece y las de abajo suben suave; al agregar, aparece. -->
    <TransitionGroup
      v-else
      tag="ul"
      name="linea"
      role="list"
      class="lineas"
      :class="{ 'lineas--compactas': compacta }"
    >
      <li
        v-for="linea in lineas"
        :key="linea.id"
        class="linea"
        :data-producto="linea.producto.id"
        :data-linea="linea.id"
        tabindex="-1"
      >
        <FilaDeCarrito
          :nombre="linea.producto.nombre"
          :imagen="fotos.foto(linea.producto.id)"
          :categoria="linea.producto.categoriaNombre"
          :unidad="linea.producto.unidad"
          :cantidad="linea.cantidad"
          :texto-precio="textoPrecio(linea)"
          :texto-importe="linea.importe ? formatearDinero(linea.importe) : '—'"
          :texto-quedan="linea.quedan"
          precio-editable
          :concepto="esVenta ? 'precio' : 'costo'"
          :texto-precio-especial="
            linea.precioCambiado ? (esVenta ? 'Precio especial' : 'Costo nuevo') : undefined
          "
          :valor-precio="textoDePrecio(linea.precio)"
          :error-cantidad="linea.errorCantidad"
          :error-precio="linea.errorPrecio"
          :puede-separar="sePuedePartir(linea)"
          :maximo-cantidad="linea.maximo ? linea.maximo.milesimas / 1000 : undefined"
          :maximo-separar="linea.cantidadLeida ? linea.cantidadLeida.milesimas / 1000 : undefined"
          :error-unidades="linea.errorUnidades"
          :compacta="compacta"
          @update:cantidad="carrito.cambiarCantidad(linea.id, $event)"
          @cambiar-precio="
            esVenta ? pedirCambioDePrecio(linea, $event) : carrito.cambiarPrecio(linea.id, $event)
          "
          @separar="(unidades, precio) => carrito.cambiarPrecio(linea.id, precio, unidades)"
          @edicion-abierta="carrito.marcarEdicion(linea.id, $event)"
          @cancelar-precio="carrito.cancelarPrecio(linea.id)"
          @quitar="quitar(linea.id, linea.producto.nombre)"
        />
      </li>
    </TransitionGroup>

    <DialogoConfirmacion
      v-if="esVenta"
      :abierto="cambio !== null && perdida === null"
      :titulo="`¿Cambiar el precio de ${cambio?.producto.nombre ?? ''}?`"
      :mensaje="`Desde ahora se venderá a ${cambio ? formatearDinero(cambio.nuevo) : ''} (antes ${cambio ? formatearDinero(cambio.antes) : ''}).`"
      texto-confirmar="Cambiar precio"
      @confirmar="confirmarCambioDePrecio(false)"
      @cancelar="cancelarCambioDePrecio"
    />
    <!-- RN-CAT-05 / RN-UX-08: un precio con pérdida se confirma mostrando cuánto se pierde. -->
    <DialogoConfirmacion
      v-if="esVenta"
      :abierto="perdida !== null"
      titulo="¿Guardar con este precio?"
      :mensaje="perdida ?? ''"
      texto-confirmar="Sí, guardar así"
      texto-cancelar="No cambiar"
      @confirmar="confirmarCambioDePrecio(true)"
      @cancelar="cancelarCambioDePrecio"
    />
  </div>
</template>

<style scoped>
.vacio {
  margin: 0;
  padding: var(--espacio-4);
  border: 2px dashed var(--color-borde);
  border-radius: var(--radio);
  color: var(--color-texto-suave);
  text-align: center;
}
.lineas {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: max(var(--separacion-toque), var(--espacio-2));
  margin: 0;
  padding: 0;
  list-style: none;
}
.linea {
  min-inline-size: 0;
  border-radius: var(--radio);
}
/* RN-OP-22: las líneas compactas no llevan caja; una raya entre una y otra las separa. */
.lineas--compactas {
  gap: 0;
}
.lineas--compactas .linea + .linea {
  border-block-start: 1px solid var(--color-borde);
  border-radius: 0;
}
.linea-enter-active,
.linea-leave-active {
  transition:
    opacity var(--duracion-hoja) ease,
    transform var(--duracion-hoja) var(--curva-hoja-entrar);
}
.linea-enter-from,
.linea-leave-to {
  opacity: 0;
  transform: translateX(-1.5rem);
}
/* La que sale deja de ocupar lugar: las de abajo suben (linea-move). */
.linea-leave-active {
  position: absolute;
  inset-inline: 0;
}
.linea-move {
  transition: transform var(--duracion-hoja) var(--curva-hoja-entrar);
}
/* r2 #2: la línea recién agregada recibe el foco (tabindex -1, no entra en el orden de Tab). */
.linea:focus-visible {
  outline: 3px solid var(--color-foco);
  outline-offset: 2px;
}
</style>
