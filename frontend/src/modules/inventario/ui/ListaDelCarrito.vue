<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Cantidad } from '@/shared/domain/cantidad'
import { formatearDinero } from '@/shared/domain/formato'
import { useAnunciador } from '@/shared/ui/anunciador'
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
const refRaiz = ref<HTMLElement>()

/**
 * El botón Quitar desaparece con su línea: el foco va al título del carrito (no se pierde). Si era
 * la última línea del panel de venta, el panel baja y desaparece: el foco va al título de la
 * pantalla.
 */
async function quitar(lineaId: string, nombre: string): Promise<void> {
  const contenedor = refRaiz.value?.closest<HTMLElement>('.columna-carrito, .panel-de-venta')
  props.carrito.quitar(lineaId)
  anunciador.anunciar(`${props.concepto === 'venta' ? 'Cancelaste' : 'Quitaste'} ${nombre}`)
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
/** RN-OP-11: al vender más de una, se puede vender alguna a otro precio. Solo desde la línea
 * con el precio de siempre (las de precio especial ya son la parte separada). */
function sePuedePartir(linea: (typeof lineas.value)[number]): boolean {
  return esVenta.value && !linea.precioCambiado && (linea.cantidadLeida?.mayorQue(UNA) ?? false)
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
    <ul v-else role="list" class="lineas" :class="{ 'lineas--compactas': compacta }">
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
          :texto-quitar="esVenta ? 'Cancelar' : 'Quitar'"
          @update:cantidad="carrito.cambiarCantidad(linea.id, $event)"
          @cambiar-precio="carrito.cambiarPrecio(linea.id, $event)"
          @separar="(unidades, precio) => carrito.cambiarPrecio(linea.id, precio, unidades)"
          @edicion-abierta="carrito.marcarEdicion(linea.id, $event)"
          @cancelar-precio="carrito.cancelarPrecio(linea.id)"
          @quitar="quitar(linea.id, linea.producto.nombre)"
        />
      </li>
    </ul>
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
/* r2 #2: la línea recién agregada recibe el foco (tabindex -1, no entra en el orden de Tab). */
.linea:focus-visible {
  outline: 3px solid var(--color-foco);
  outline-offset: 2px;
}
</style>
