<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { formatearDinero } from '@/shared/domain/formato'
import { useAnunciador } from '@/shared/ui/anunciador'
import FilaDeCarrito from '@/shared/ui/componentes/FilaDeCarrito.vue'
import { textoDePrecio, type CarritoDePantalla, type Concepto } from './carrito-de-pantalla'
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
}>()

const fotos = usarFotos()
const anunciador = useAnunciador()
const refRaiz = ref<HTMLElement>()

/** El botón Quitar desaparece con su línea: el foco va al título del carrito (no se pierde). */
async function quitar(productoId: string, nombre: string): Promise<void> {
  props.carrito.quitar(productoId)
  anunciador.anunciar(`Quitaste ${nombre}`)
  await nextTick()
  refRaiz.value?.closest('.columna-carrito')?.querySelector<HTMLElement>('.titulo-carrito')?.focus()
}
const lineas = computed(() => props.carrito.lineas.value)
watch(
  () => lineas.value.map((l) => l.producto),
  (productos) => void fotos.cargar(productos),
  { immediate: true },
)

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
    <ul v-else role="list" class="lineas">
      <li
        v-for="linea in lineas"
        :key="linea.producto.id"
        class="linea"
        :data-producto="linea.producto.id"
      >
        <FilaDeCarrito
          :nombre="linea.producto.nombre"
          :imagen="fotos.foto(linea.producto.id)"
          :categoria="linea.producto.categoriaNombre"
          :unidad="linea.producto.unidad"
          :cantidad="linea.cantidad"
          :texto-precio="textoPrecio(linea)"
          :texto-importe="linea.importe ? formatearDinero(linea.importe) : '—'"
          precio-editable
          :concepto="esVenta ? 'precio' : 'costo'"
          :texto-precio-especial="
            linea.precioCambiado ? (esVenta ? 'Precio especial' : 'Costo nuevo') : undefined
          "
          :valor-precio="textoDePrecio(linea.precio)"
          :error-cantidad="linea.errorCantidad"
          :error-precio="linea.errorPrecio"
          @update:cantidad="carrito.cambiarCantidad(linea.producto.id, $event)"
          @cambiar-precio="carrito.cambiarPrecio(linea.producto.id, $event)"
          @cancelar-precio="carrito.cancelarPrecio(linea.producto.id)"
          @quitar="quitar(linea.producto.id, linea.producto.nombre)"
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
}
</style>
