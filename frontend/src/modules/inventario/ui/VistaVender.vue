<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Check, ShoppingCart } from 'lucide-vue-next'
import type { ProductoVista } from '@/modules/catalogo'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { formatearCantidad, formatearDinero } from '@/shared/domain/formato'
import { useAnunciador } from '@/shared/ui/anunciador'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import BarraDeTotal from '@/shared/ui/componentes/BarraDeTotal.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import PantallaExito from '@/shared/ui/componentes/PantallaExito.vue'
import { pegarCifras } from '@/shared/ui/texto-sin-cortes'
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
 * el primer producto sube el panel de venta ya abierto (las líneas con cuánto queda; oculto, solo
 * el total y Confirmar venta) → Confirmar venta → pantalla de éxito con
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
/** Lo que se vendió, para la pantalla de éxito: "2 unid. × S/ 3.50" e importe por línea. */
interface LineaVendida {
  id: string
  nombre: string
  detalle: string
  importe: string
  especial: boolean
}
const vendido = ref<LineaVendida[]>([])
const errorFecha = ref<ErrorDeFecha>()

const textoTotal = computed(() => formatearDinero(carrito.total.value))

// Cada cambio del total (producto agregado, cantidad cambiada, línea quitada) se anuncia con el
// mismo mecanismo aria-live que ya usa el carrito.
watch(textoTotal, (nuevo) => {
  if (!carrito.vacio.value) anunciador.anunciar(`Total ${nuevo}`)
})

// Sin líneas: en celular el panel baja con su animación (PanelDeVenta); en PC no hay hoja.
watch(carrito.vacio, (vacio) => {
  if (vacio && esPC.value) expandido.value = false
})

async function agregar(producto: ProductoVista, origen: OrigenDeLaEleccion): Promise<void> {
  // RN-OP-05: nunca más de lo que hay (contando todas las líneas del producto).
  if (!carrito.puedeAgregar(producto)) {
    anunciador.anunciar(`No quedan más ${producto.nombre}`)
    return
  }
  const primero = carrito.vacio.value
  const lineaId = carrito.agregar(producto)
  anunciador.anunciar(`Agregaste ${producto.nombre}`)
  if (esPC.value) {
    if (origen === 'resultados') void enfocarLinea(lineaId)
    return
  }
  // RN-OP-22: con el primer producto el panel aparece ya abierto, a toda la pantalla; el foco
  // pasa a su título (lo de atrás queda inerte).
  if (primero) {
    expandido.value = true
    await nextTick()
    document.querySelector<HTMLElement>('.panel-de-venta .titulo-carrito')?.focus()
  }
}

async function abrirDetalle(): Promise<void> {
  expandido.value = true
  await enfocarPrimerError('.lista-del-carrito')
}

/** La fecha de "Otro día" falta o no vale: el panel se abre y el foco va a ese campo. */
async function revisarFecha(): Promise<void> {
  expandido.value = true
  await enfocarPrimerError('.vista-vender .cuando-fue')
}

async function confirmar(): Promise<void> {
  if (registrando.value) return
  if (carrito.hayEdicionAbierta.value) {
    // RN-OP-11: un precio escrito sin guardar no se registra por error.
    anunciador.anunciar('Guarda o cancela el precio para confirmar.')
    return
  }
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
    await revisarFecha()
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
      await revisarFecha()
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
  vendido.value = carrito.lineas.value.map((linea) => ({
    id: linea.id,
    nombre: linea.producto.nombre,
    detalle: linea.cantidadLeida
      ? `${formatearCantidad(linea.cantidadLeida, linea.producto.unidad)} × ${formatearDinero(linea.precio)}`
      : '',
    importe: linea.importe ? formatearDinero(linea.importe) : '',
    especial: linea.precioCambiado,
  }))
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
  <div class="vista-vender" :class="{ 'vista-vender--con-panel': !esPC && paso === 'carrito' }">
    <PantallaExito
      v-if="paso === 'exito'"
      titulo="Venta registrada"
      :detalle="detalleDeExito"
      al-centro
    >
      <ul v-if="vendido.length > 0" class="vendido" aria-label="Lo que vendiste">
        <li v-for="linea in vendido" :key="linea.id" class="linea-vendida">
          <span class="nombre-vendido">{{ linea.nombre }}</span>
          <span class="importe-vendido">{{ linea.importe }}</span>
          <span class="detalle-vendido">
            {{ pegarCifras(linea.detalle)
            }}<template v-if="linea.especial"> · Precio especial</template>
          </span>
        </li>
      </ul>
      <BotonPrincipal
        class="accion-exito"
        texto="Nueva venta"
        :icono="ShoppingCart"
        @click="nuevaVenta"
      />
    </PantallaExito>

    <template v-else>
      <EncabezadoPagina titulo="Vender" />
      <!-- Con la hoja abierta (celular), los avisos de atrás tampoco se alcanzan. -->
      <div class="avisos" :inert="!esPC && expandido ? true : undefined">
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
            :deshabilitado="registrando || carrito.hayEdicionAbierta.value"
            @accion="confirmar"
          />
        </template>
      </DisposicionDeCarrito>

      <!-- Celular: la grilla ocupa la pantalla y el panel de venta queda abajo. -->
      <template v-else>
        <!-- Con la hoja abierta, lo de atrás no se alcanza (ni con Tab ni con el lector). -->
        <div class="buscador" :inert="expandido ? true : undefined">
          <BuscadorDeProductos concepto="venta" @elegir="agregar" />
        </div>
        <!-- RN-OP-22: siempre abajo (en S/ 0.00 sin productos); con el primero crece a toda la
             pantalla y al ocultarse vuelve a ese bloque. -->
        <PanelDeVenta
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
      </template>
    </template>
  </div>
</template>

<style scoped>
/* Celular: la pantalla llena el alto libre y el panel de venta queda abajo, sobre la navegación
   (--alto-pie, medido en vivo), aunque la grilla sea corta. */
.vista-vender--con-panel {
  display: flex;
  flex-direction: column;
  min-block-size: calc(100dvh - var(--alto-pie, 0px) - 2 * var(--espacio-4));
}
.vista-vender--con-panel :deep(.panel-de-venta) {
  margin-block-start: auto;
}
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
.vendido {
  display: grid;
  gap: var(--espacio-2);
  inline-size: 100%;
  max-inline-size: 28rem;
  margin: var(--espacio-2) 0 0;
  padding: var(--espacio-3) var(--espacio-4);
  border: 1px solid var(--color-borde-foto);
  border-radius: var(--radio);
  background: var(--color-superficie);
  color: var(--color-texto);
  list-style: none;
  text-align: start;
}
.linea-vendida {
  /* Nombre e importe en una fila; si el nombre no entra sin partir una palabra (320 px, letra
     Muy grande), el importe baja a su propia fila. */
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--espacio-3);
}
.linea-vendida + .linea-vendida {
  padding-block-start: var(--espacio-2);
  border-block-start: 1px solid var(--color-borde-foto);
}
.nombre-vendido {
  flex: 1 1 8rem;
  font-weight: 700;
}
.importe-vendido {
  margin-inline-start: auto;
  font-weight: 700;
  white-space: nowrap;
}
.detalle-vendido {
  flex-basis: 100%;
  color: var(--color-texto-suave);
}
.accion-exito {
  align-self: stretch;
  margin: var(--espacio-4) auto 0;
  max-inline-size: 28rem;
}
</style>
