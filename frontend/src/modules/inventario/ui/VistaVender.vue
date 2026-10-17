<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { Banknote, Check, ShoppingCart } from 'lucide-vue-next'
import type { ProductoVista } from '@/modules/catalogo'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { formatearCantidad, formatearDinero } from '@/shared/domain/formato'
import { useAnunciador } from '@/shared/ui/anunciador'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import BarraDeTotal from '@/shared/ui/componentes/BarraDeTotal.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import FilaDeDato from '@/shared/ui/componentes/FilaDeDato.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import PantallaExito from '@/shared/ui/componentes/PantallaExito.vue'
import SelectorDeBilletes from '@/shared/ui/componentes/SelectorDeBilletes.vue'
import { pegarCifras } from '@/shared/ui/texto-sin-cortes'
import { BILLETES_DE_SOLES } from '@/shared/ui/tipos-de-productos'
import { calcularVuelto } from '../domain/vuelto'
import BuscadorDeProductos from './BuscadorDeProductos.vue'
import CuandoFue from './CuandoFue.vue'
import DisposicionDeCarrito from './DisposicionDeCarrito.vue'
import ListaDelCarrito from './ListaDelCarrito.vue'
import { textoDePrecio, usarCarrito } from './carrito-de-pantalla'
import { cuandoInicial, ERRORES_DE_FECHA, instanteDe } from './cuando'
import { enfocarPrimerError, enfocarTitulo, vibrar } from './foco-y-respuesta'
import { errorParaMostrar, type ErrorParaMostrar } from './mensajes-de-error'
import { usarDeshacer } from './usar-deshacer'
import { hoyEnLaTienda } from './hoy-en-la-tienda'

/**
 * Vender (HU-OP-01, HU-OP-02; 06-experiencia-de-uso): buscar o tocar un más vendido → carrito
 * con − / + y precio especial → Cobrar con billetes y vuelto → Confirmar venta → pantalla de
 * éxito con Deshacer (10 s) → Nueva venta, vacía.
 */
type Paso = 'carrito' | 'cobro' | 'exito'

const aplicacion = useAplicacion()
const anunciador = useAnunciador()
const carrito = usarCarrito('venta')
const deshacer = usarDeshacer()

const idResumen = useId()
const paso = ref<Paso>('carrito')
const pagado = ref('')
const registrando = ref(false)
const error = ref<ErrorParaMostrar | null>(null)
const detalleDeExito = ref('')
const deshecha = ref(false)
/** RN-OP-09 / HU-OP-07: la venta es de ahora o de otro día (hasta 7 días atrás). */
const cuando = ref(cuandoInicial(hoyEnLaTienda()))
const errorFecha = ref<string>()

const textoTotal = computed(() => formatearDinero(carrito.total.value))
/** RN-OP-13: "Vuelto S/ 5.37" / "Faltan S/ 4.63"; sin monto escrito se puede confirmar igual. */
const vuelto = computed(() => calcularVuelto(carrito.total.value, pagado.value))
const tonoDelVuelto = computed(() => {
  if (vuelto.value.vuelto) return 'exito' as const
  return vuelto.value.mensaje ? ('atencion' as const) : ('normal' as const)
})

function agregar(producto: ProductoVista): void {
  deshecha.value = false
  carrito.agregar(producto)
  anunciador.anunciar(`Agregaste ${producto.nombre}. Total ${textoTotal.value}`)
}

async function cobrar(): Promise<void> {
  carrito.marcarVacias()
  if (carrito.hayErrores.value) {
    await enfocarPrimerError('.lista-del-carrito')
    anunciador.anunciar('Revisa lo que está marcado en el carrito.')
    return
  }
  error.value = null
  errorFecha.value = undefined
  pagado.value = ''
  paso.value = 'cobro'
  await enfocarTitulo()
}

async function volverAlCarrito(): Promise<void> {
  paso.value = 'carrito'
  await enfocarTitulo()
}

/** RN-OP-05: con el stock al día, las líneas que ya no alcanzan se marcan junto a su campo. */
async function actualizarStock(): Promise<void> {
  const productos = await Promise.all(
    carrito.lineas.value.map((l) => aplicacion.catalogo.obtenerProducto(l.producto.id)),
  )
  carrito.actualizarProductos(productos.filter((p): p is ProductoVista => p !== null))
}

async function confirmar(): Promise<void> {
  if (registrando.value || !vuelto.value.puedeConfirmar) return
  error.value = null
  const fecha = instanteDe(cuando.value)
  errorFecha.value = fecha.error
  if (fecha.error) return
  registrando.value = true
  try {
    await aplicacion.inventario.registrarVenta({
      ...carrito.aDatosDeVenta(),
      ...(fecha.instante ? { ocurridaEn: fecha.instante } : {}),
    })
  } catch (causa) {
    const mostrado = errorParaMostrar(causa, 'venta')
    registrando.value = false
    if (mostrado.codigo && ERRORES_DE_FECHA.has(mostrado.codigo)) {
      errorFecha.value = mostrado.mensaje
      return
    }
    error.value = mostrado
    if (error.value.codigo === 'STOCK_INSUFICIENTE') {
      await actualizarStock()
      paso.value = 'carrito'
    }
    return
  }
  registrando.value = false
  const copia = carrito.copia()
  const cambio = vuelto.value.vuelto
  detalleDeExito.value = cambio
    ? `Total ${textoTotal.value} · Vuelto ${formatearDinero(cambio)}`
    : `Total ${textoTotal.value}`
  carrito.vaciar()
  pagado.value = ''
  cuando.value = cuandoInicial(hoyEnLaTienda())
  paso.value = 'exito'
  vibrar()
  deshacer.ofrecer({
    mensaje: 'Venta registrada',
    deshecho: 'Deshiciste la venta',
    alDeshacer: () => {
      // Lo más común es haberse equivocado en algo: el carrito vuelve para corregirlo. Si ya
      // se empezó otra venta, no se pisa lo que se está cargando.
      if (!carrito.vacio.value) return
      carrito.restaurar(copia)
      deshecha.value = true
      paso.value = 'carrito'
      void enfocarTitulo()
    },
  })
}

async function nuevaVenta(): Promise<void> {
  deshecha.value = false
  paso.value = 'carrito'
  await enfocarTitulo()
}

/** "Exacto": paga justo el total. */
function pagoExacto(): void {
  pagado.value = textoDePrecio(carrito.total.value)
}

const resumenDelCobro = computed(() =>
  carrito.lineas.value.map((l) => ({
    id: l.producto.id,
    // "× 1 kg" nunca se parte (la etiqueta de FilaDeDato no pasa por pegarCifras).
    etiqueta: pegarCifras(
      `${l.producto.nombre} × ${l.cantidadLeida ? formatearCantidad(l.cantidadLeida, l.producto.unidad) : l.cantidad}`,
    ),
    valor: l.importe ? formatearDinero(l.importe) : '—',
  })),
)
</script>

<template>
  <div class="vista-vender">
    <PantallaExito v-if="paso === 'exito'" titulo="Venta registrada" :detalle="detalleDeExito">
      <BotonPrincipal
        class="accion-exito"
        texto="Nueva venta"
        :icono="ShoppingCart"
        @click="nuevaVenta"
      />
    </PantallaExito>

    <div v-else-if="paso === 'cobro'" class="cobro">
      <EncabezadoPagina titulo="Cobrar" volver @volver="volverAlCarrito" />
      <SelectorDeBilletes
        v-model="pagado"
        :texto-total="textoTotal"
        :billetes="BILLETES_DE_SOLES"
        :mensaje="vuelto.mensaje"
        :tono-mensaje="tonoDelVuelto"
        @exacto="pagoExacto"
      />
      <CuandoFue v-model="cuando" pregunta="¿Cuándo fue la venta?" :error="errorFecha" />
      <MensajeDeError v-if="error" :mensaje="error.mensaje" :ayuda="error.ayuda" />
      <section class="resumen-del-cobro" :aria-labelledby="idResumen">
        <h2 :id="idResumen" class="subtitulo">Lo que se vende</h2>
        <FilaDeDato
          v-for="fila in resumenDelCobro"
          :key="fila.id"
          :etiqueta="fila.etiqueta"
          :texto-valor="fila.valor"
        />
      </section>
      <!-- Principio 1: "Confirmar venta" siempre a la vista, abajo, con el vuelto al lado. -->
      <BarraDeTotal
        :etiqueta="vuelto.vuelto ? 'Vuelto' : 'Total'"
        :texto-total="vuelto.vuelto ? formatearDinero(vuelto.vuelto) : textoTotal"
        texto-accion="Confirmar venta"
        :icono="Check"
        :deshabilitado="!vuelto.puedeConfirmar || registrando"
        @accion="confirmar"
      />
    </div>

    <template v-else>
      <EncabezadoPagina titulo="Vender" />
      <div class="avisos">
        <AvisoEnPagina
          v-if="deshecha"
          tono="info"
          titulo="Deshiciste la venta"
          texto="Tus productos siguen aquí por si quieres corregir algo."
          texto-cerrar="Cerrar"
          @cerrar="deshecha = false"
        />
        <MensajeDeError
          v-if="deshacer.error.value"
          :mensaje="deshacer.error.value.mensaje"
          :ayuda="deshacer.error.value.ayuda"
        />
        <MensajeDeError v-if="error" :mensaje="error.mensaje" :ayuda="error.ayuda" />
      </div>
      <DisposicionDeCarrito titulo-carrito="En esta venta">
        <template #buscador>
          <BuscadorDeProductos concepto="venta" @elegir="agregar" />
        </template>
        <template #carrito>
          <ListaDelCarrito
            :carrito="carrito"
            concepto="venta"
            texto-vacio="Toca un producto para agregarlo."
          />
        </template>
        <template #total>
          <BarraDeTotal
            v-if="!carrito.vacio.value"
            etiqueta="Total"
            :texto-total="textoTotal"
            texto-accion="Cobrar"
            :icono="Banknote"
            @accion="cobrar"
          />
        </template>
      </DisposicionDeCarrito>
    </template>
  </div>
</template>

<style scoped>
.avisos {
  display: grid;
  gap: var(--espacio-3);
}
.avisos:not(:empty) {
  margin-bottom: var(--espacio-4);
}
.cobro {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-5);
  max-inline-size: 40rem;
  margin-inline: auto;
}
.resumen-del-cobro {
  min-inline-size: 0;
}
.subtitulo {
  margin: 0 0 var(--espacio-2);
  font-size: 1.125rem;
}
.accion-exito {
  align-self: stretch;
  margin: var(--espacio-4) auto 0;
  max-inline-size: 28rem;
}
</style>
