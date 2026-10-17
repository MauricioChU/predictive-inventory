<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { Banknote, Check, ShoppingCart } from 'lucide-vue-next'
import type { ProductoVista } from '@/modules/catalogo'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { formatearCantidad, formatearDinero } from '@/shared/domain/formato'
import { useAnunciador } from '@/shared/ui/anunciador'
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
import BuscadorDeProductos, { type OrigenDeLaEleccion } from './BuscadorDeProductos.vue'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import CuandoFue from './CuandoFue.vue'
import DisposicionDeCarrito from './DisposicionDeCarrito.vue'
import ListaDelCarrito from './ListaDelCarrito.vue'
import { textoDePrecio } from './carrito-de-pantalla'
import { useCarritos } from './carritos'
import { errorDeFechaDelDominio, instanteDe, type ErrorDeFecha } from './cuando'
import { enfocarLinea, enfocarPrimerError, enfocarTitulo, vibrar } from './foco-y-respuesta'
import { errorParaMostrar, type ErrorParaMostrar } from './mensajes-de-error'
import { usarCarritoAlDia } from './usar-carrito-al-dia'
import { usarDeshacer } from './usar-deshacer'

/**
 * Vender (HU-OP-01, HU-OP-02; 06-experiencia-de-uso): buscar o tocar un más vendido → carrito
 * con − / + y precio especial → Cobrar con billetes y vuelto → Confirmar venta → pantalla de
 * éxito con Deshacer (10 s) → Nueva venta, vacía.
 */
type Paso = 'carrito' | 'cobro' | 'exito'

const aplicacion = useAplicacion()
const anunciador = useAnunciador()
// r1 M9: el carrito (con su fecha) vive en un store: tocar otra pantalla no lo borra.
const carrito = useCarritos().venta
const cuando = carrito.cuando
// r2 #1: al volver con un carrito guardado, sus productos se ponen al día.
const alDia = usarCarritoAlDia(carrito)
const deshacer = usarDeshacer()

const idResumen = useId()
const paso = ref<Paso>('carrito')
const pagado = ref('')
const registrando = ref(false)
const error = ref<ErrorParaMostrar | null>(null)
const detalleDeExito = ref('')
const errorFecha = ref<ErrorDeFecha>()

const textoTotal = computed(() => formatearDinero(carrito.total.value))
/** RN-OP-13: "Vuelto S/ 5.37" / "Faltan S/ 4.63"; sin monto escrito se puede confirmar igual. */
const vuelto = computed(() => calcularVuelto(carrito.total.value, pagado.value))
const tonoDelVuelto = computed(() => {
  if (vuelto.value.vuelto) return 'exito' as const
  return vuelto.value.mensaje ? ('atencion' as const) : ('normal' as const)
})

function agregar(producto: ProductoVista, origen: OrigenDeLaEleccion): void {
  carrito.agregar(producto)
  anunciador.anunciar(`Agregaste ${producto.nombre}. Total ${textoTotal.value}`)
  if (origen === 'resultados') void enfocarLinea(producto.id)
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

async function confirmar(): Promise<void> {
  if (registrando.value || !vuelto.value.puedeConfirmar) return
  error.value = null
  const fecha = instanteDe(cuando.value)
  errorFecha.value = fecha.error
  if (fecha.error) return
  registrando.value = true
  try {
    // r2 #1: con los precios de ahora a la vista, se manda el precio que se vio si cambió.
    const precios = await alDia.preciosActuales()
    await aplicacion.inventario.registrarVenta({
      ...carrito.aDatosDeVenta(precios),
      ...(fecha.instante ? { ocurridaEn: fecha.instante } : {}),
    })
  } catch (causa) {
    const mostrado = errorParaMostrar(causa, 'venta')
    registrando.value = false
    errorFecha.value = errorDeFechaDelDominio(mostrado.codigo, mostrado.mensaje)
    if (errorFecha.value) return
    error.value = mostrado
    if (error.value.codigo === 'STOCK_INSUFICIENTE') {
      // RN-OP-05: con el stock al día, las líneas que ya no alcanzan se marcan junto a su campo.
      await alDia.refrescar()
      paso.value = 'carrito'
    }
    return
  }
  registrando.value = false
  const copia = carrito.copia()
  const totalVendido = textoTotal.value
  const cambio = vuelto.value.vuelto
  detalleDeExito.value = cambio
    ? `Total ${totalVendido} · Vuelto ${formatearDinero(cambio)}`
    : `Total ${totalVendido}`
  carrito.vaciar()
  pagado.value = ''
  paso.value = 'exito'
  vibrar()
  deshacer.ofrecer({
    mensaje: 'Venta registrada',
    alDeshacer: ({ pantallaAbierta }) => {
      const deshecha = `Deshiciste la venta de ${totalVendido}`
      // r1 #2: si ya se está cargando otra venta, no se toca; lo dice el resultado.
      if (!carrito.vacio.value) {
        return pantallaAbierta
          ? `${deshecha}. Lo que estás cargando sigue aquí.`
          : `${deshecha}. Lo que estabas cargando sigue en Vender.`
      }
      // Lo más común es haberse equivocado en algo: el carrito vuelve (con su fecha, r1 M3)
      // para corregirlo, aunque la persona ya esté en otra pantalla.
      carrito.restaurar(copia)
      if (pantallaAbierta) paso.value = 'carrito'
      return `${deshecha}. Tus productos volvieron al carrito.`
    },
  })
}

async function nuevaVenta(): Promise<void> {
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
          v-if="alDia.quitados.value.length > 0"
          tono="atencion"
          :titulo="alDia.textoDeQuitados.value"
          texto-cerrar="Cerrar"
          @cerrar="alDia.cerrarAviso"
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
