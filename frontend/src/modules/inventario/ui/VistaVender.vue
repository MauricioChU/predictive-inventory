<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, ShoppingCart } from 'lucide-vue-next'
import type { ProductoVista } from '@/modules/catalogo'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { formatearDinero } from '@/shared/domain/formato'
import { useAnunciador } from '@/shared/ui/anunciador'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import BarraDeTotal from '@/shared/ui/componentes/BarraDeTotal.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import PantallaExito from '@/shared/ui/componentes/PantallaExito.vue'
import { usarPantallaAncha } from '@/shared/ui/usar-pantalla-ancha'
import BuscadorDeProductos, { type OrigenDeLaEleccion } from './BuscadorDeProductos.vue'
import CuandoFue from './CuandoFue.vue'
import DisposicionDeCarrito from './DisposicionDeCarrito.vue'
import ListaDelCarrito from './ListaDelCarrito.vue'
import PanelDeVenta from './PanelDeVenta.vue'
import { useCarritos } from './carritos'
import { errorDeFechaDelDominio, instanteDe, type ErrorDeFecha } from './cuando'
import { enfocarLinea, enfocarPrimerError, enfocarTitulo, vibrar } from './foco-y-respuesta'
import { errorParaMostrar, type ErrorParaMostrar } from './mensajes-de-error'
import { usarCarritoAlDia } from './usar-carrito-al-dia'
import { usarDeshacer } from './usar-deshacer'

/**
 * Vender (HU-OP-01, RN-OP-22; 06-experiencia-de-uso): buscar o tocar un más vendido → al agregar
 * el primer producto sube el panel de venta (total y Confirmar venta; abierto, las líneas con
 * cuánto queda de cada una y ¿Cuándo fue la venta?) → Confirmar venta → pantalla de éxito con
 * Deshacer (10 s) → Nueva venta, vacía. En PC (≥ 1024 px) el carrito va a la derecha, sin panel.
 */
type Paso = 'carrito' | 'exito'

const aplicacion = useAplicacion()
const anunciador = useAnunciador()
// r1 M9: el carrito (con su fecha) vive en un store: tocar otra pantalla no lo borra.
const carrito = useCarritos().venta
const cuando = carrito.cuando
// r2 #1: al volver con un carrito guardado, sus productos se ponen al día.
const alDia = usarCarritoAlDia(carrito)
const deshacer = usarDeshacer()
const esPC = usarPantallaAncha()

const paso = ref<Paso>('carrito')
const expandido = ref(false)
const registrando = ref(false)
const error = ref<ErrorParaMostrar | null>(null)
const detalleDeExito = ref('')
const errorFecha = ref<ErrorDeFecha>()

const textoTotal = computed(() => formatearDinero(carrito.total.value))

// Cada cambio del total (producto agregado, cantidad cambiada, línea quitada) se anuncia con el
// mismo mecanismo aria-live que ya usa el carrito.
watch(textoTotal, (nuevo) => {
  if (!carrito.vacio.value) anunciador.anunciar(`Total ${nuevo}`)
})

// Sin líneas no hay panel que abrir.
watch(carrito.vacio, (vacio) => {
  if (vacio) expandido.value = false
})

function agregar(producto: ProductoVista, origen: OrigenDeLaEleccion): void {
  carrito.agregar(producto)
  anunciador.anunciar(`Agregaste ${producto.nombre}`)
  // En celular el panel va compacto: no hay línea a la que llevar el foco.
  if (origen === 'resultados' && esPC.value) void enfocarLinea(producto.id)
}

async function abrirDetalle(): Promise<void> {
  expandido.value = true
  await enfocarPrimerError('.lista-del-carrito')
}

async function confirmar(): Promise<void> {
  if (registrando.value) return
  carrito.marcarVacias()
  if (carrito.hayErrores.value) {
    // Lo que falla se ve y se toca junto a su campo: el panel se abre y el foco va ahí.
    expandido.value = true
    await enfocarPrimerError('.lista-del-carrito')
    anunciador.anunciar('Revisa lo que está marcado en el carrito.')
    return
  }
  error.value = null
  const fecha = instanteDe(cuando.value)
  errorFecha.value = fecha.error
  if (fecha.error) {
    expandido.value = true
    return
  }
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
    if (errorFecha.value) {
      await abrirDetalle()
      return
    }
    error.value = mostrado
    if (error.value.codigo === 'STOCK_INSUFICIENTE') {
      // RN-OP-05: con el stock al día, las líneas que ya no alcanzan se marcan junto a su campo.
      await alDia.refrescar()
      await abrirDetalle()
    }
    return
  }
  registrando.value = false
  const copia = carrito.copia()
  const totalVendido = textoTotal.value
  detalleDeExito.value = `Total ${totalVendido}`
  carrito.vaciar()
  expandido.value = false
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
        <MensajeDeError v-if="error && esPC" :mensaje="error.mensaje" :ayuda="error.ayuda" />
      </div>

      <!-- PC: el carrito a la derecha del buscador, con lo mismo que el panel abierto. -->
      <DisposicionDeCarrito v-if="esPC" titulo-carrito="En esta venta">
        <template #buscador>
          <BuscadorDeProductos concepto="venta" @elegir="agregar" />
        </template>
        <template #carrito>
          <ListaDelCarrito
            :carrito="carrito"
            concepto="venta"
            texto-vacio="Toca un producto para agregarlo."
          />
          <CuandoFue
            v-if="!carrito.vacio.value"
            v-model="cuando"
            pregunta="¿Cuándo fue la venta?"
            :error="errorFecha"
          />
        </template>
        <template #total>
          <BarraDeTotal
            v-if="!carrito.vacio.value"
            etiqueta="Total"
            :texto-total="textoTotal"
            texto-accion="Confirmar venta"
            :icono="Check"
            :deshabilitado="registrando"
            @accion="confirmar"
          />
        </template>
      </DisposicionDeCarrito>

      <!-- Celular: la grilla ocupa la pantalla y el panel sube cuando hay algo en la venta. -->
      <template v-else>
        <!-- Con la hoja abierta, lo de atrás no se alcanza (ni con Tab ni con el lector). -->
        <div class="buscador" :inert="expandido ? true : undefined">
          <BuscadorDeProductos concepto="venta" @elegir="agregar" />
        </div>
        <Transition name="panel">
          <PanelDeVenta
            v-if="!carrito.vacio.value"
            v-model:cuando="cuando"
            v-model:expandido="expandido"
            :carrito="carrito"
            :error-fecha="errorFecha"
            :texto-total="textoTotal"
            :registrando="registrando"
            @confirmar="confirmar"
          >
            <template v-if="error" #avisos>
              <MensajeDeError :mensaje="error.mensaje" :ayuda="error.ayuda" />
            </template>
          </PanelDeVenta>
        </Transition>
      </template>
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
.buscador {
  min-inline-size: 0;
}
.accion-exito {
  align-self: stretch;
  margin: var(--espacio-4) auto 0;
  max-inline-size: 28rem;
}

/* El panel sube desde abajo con una transición corta (sin movimiento si el sistema lo pide:
   base.css baja todas las animaciones). */
.panel-enter-active,
.panel-leave-active {
  transition:
    transform 0.2s ease-out,
    opacity 0.2s ease-out;
}
.panel-enter-from,
.panel-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
