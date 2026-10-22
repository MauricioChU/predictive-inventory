<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PackageCheck, PackagePlus } from 'lucide-vue-next'
import type { ProductoVista } from '@/modules/catalogo'
import { useAplicacion } from '@/app/proveer-aplicacion'
import {
  formatearCantidad,
  formatearDinero,
  formatearEntero,
  plural,
} from '@/shared/domain/formato'
import { useAnunciador } from '@/shared/ui/anunciador'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import BarraDeTotal from '@/shared/ui/componentes/BarraDeTotal.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import DialogoConfirmacion from '@/shared/ui/componentes/DialogoConfirmacion.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import PantallaExito from '@/shared/ui/componentes/PantallaExito.vue'
import ResumenDeLineas, { type LineaDeResumen } from '@/shared/ui/componentes/ResumenDeLineas.vue'
import { usarPantallaAncha } from '@/shared/ui/usar-pantalla-ancha'
import type { DatosDeIngreso } from '../application/ingresos'
import BuscadorDeProductos, { type OrigenDeLaEleccion } from './BuscadorDeProductos.vue'
import CuandoFue from './CuandoFue.vue'
import DisposicionDeCarrito from './DisposicionDeCarrito.vue'
import ListaDelCarrito from './ListaDelCarrito.vue'
import PanelDeCarrito from './PanelDeCarrito.vue'
import { useCarritos } from './carritos'
import { errorDeFechaDelDominio, instanteDe, type ErrorDeFecha } from './cuando'
import { enfocarLinea, enfocarPrimerError, enfocarTitulo, vibrar } from './foco-y-respuesta'
import { errorParaMostrar, type ErrorParaMostrar } from './mensajes-de-error'
import { usarCarritoAlDia } from './usar-carrito-al-dia'
import { usarDeshacer } from './usar-deshacer'

/**
 * Llegó mercadería (HU-OP-03, HU-OP-09; en la navegación "Recibir"): igual que Vender, pero cada
 * línea lleva su costo editable. Al registrar, el caso de uso puede avisar una sobrecompra
 * (RN-OP-20, no bloquea) y preguntar si se actualiza el precio de compra (RN-OP-14, por defecto
 * sí). Con `?desde=para-comprar` arranca con la lista de hoy de Análisis (RN-AN-08).
 * En celular usa el mismo panel de Vender (PanelDeCarrito, RN-OP-22): abajo desde el inicio en
 * S/ 0.00, a toda la pantalla con el primer producto. En PC, el carrito a la derecha.
 */
type Paso = 'carrito' | 'exito'
type Aviso = { productoId: string; mensaje: string }
type Dialogo = { tipo: 'sobrecompra'; avisos: Aviso[] } | { tipo: 'precios'; cambios: Aviso[] }
type Respuestas = Pick<DatosDeIngreso, 'confirmarSobrecompra' | 'actualizarPreciosDeCompra'>

const aplicacion = useAplicacion()
const anunciador = useAnunciador()
const route = useRoute()
const router = useRouter()
// r1 M9: lo cargado (con su fecha) vive en un store: tocar otra pantalla no lo borra.
const carrito = useCarritos().ingreso
const cuando = carrito.cuando
// r2 #1: al volver con lo cargado guardado, sus productos se ponen al día.
const alDia = usarCarritoAlDia(carrito)
const deshacer = usarDeshacer()
const esPC = usarPantallaAncha()

const paso = ref<Paso>('carrito')
const expandido = ref(false)
const registrando = ref(false)
const error = ref<ErrorParaMostrar | null>(null)
const dialogo = ref<Dialogo | null>(null)
/** Lo que la persona ya respondió en esta llegada (se manda en el siguiente intento). */
let respuestas: Respuestas = {}
/** "Cambiar cantidad": el aviso queda a la vista mientras corrige. */
const avisoParaCorregir = ref<string | null>(null)
const prellenada = ref<'con-lineas' | 'vacia' | null>(null)
const detalleDeExito = ref('')
/** Lo que llegó, para la pantalla de éxito: "12 unid. × S/ 2.40" e importe por línea. */
const llegado = ref<LineaDeResumen[]>([])
const errorFecha = ref<ErrorDeFecha>()

const textoTotal = computed(() => formatearDinero(carrito.total.value))

function nombreDe(productoId: string): string {
  return carrito.lineas.value.find((l) => l.producto.id === productoId)?.producto.nombre ?? ''
}

const textoDelDialogo = computed(() => {
  const actual = dialogo.value
  if (!actual) return ''
  if (actual.tipo === 'sobrecompra') return actual.avisos.map((a) => a.mensaje).join(' ')
  if (actual.cambios.length === 1) return actual.cambios[0]!.mensaje
  return actual.cambios.map((c) => `${nombreDe(c.productoId)}: ${c.mensaje}`).join(' ')
})

const tituloDePrecios = computed(() => {
  const actual = dialogo.value
  if (actual?.tipo !== 'precios') return ''
  return actual.cambios.length === 1
    ? `Cambió el costo de ${nombreDe(actual.cambios[0]!.productoId)}`
    : 'Cambiaron los costos'
})

// Sin líneas: en celular el panel baja con su animación (PanelDeCarrito); en PC no hay hoja.
watch(carrito.vacio, (vacio) => {
  if (vacio && esPC.value) expandido.value = false
})

async function agregar(producto: ProductoVista, origen: OrigenDeLaEleccion): Promise<void> {
  const primero = carrito.vacio.value
  const lineaId = carrito.agregar(producto)
  anunciador.anunciar(`Agregaste ${producto.nombre}. Valor total ${textoTotal.value}`)
  if (esPC.value) {
    if (origen === 'resultados') void enfocarLinea(lineaId)
    return
  }
  // Con el primer producto el panel aparece ya abierto; el foco pasa a su título.
  if (primero) {
    expandido.value = true
    await nextTick()
    document.querySelector<HTMLElement>('.panel-de-venta .titulo-carrito')?.focus()
  }
}

async function registrarLlegada(): Promise<void> {
  if (registrando.value) return
  if (carrito.hayEdicionAbierta.value) {
    // RN-OP-11: un costo escrito sin guardar no se registra por error.
    anunciador.anunciar('Guarda o cancela el costo para confirmar.')
    return
  }
  carrito.marcarVacias()
  if (carrito.hayErrores.value) {
    if (!esPC.value) expandido.value = true
    await enfocarPrimerError('.lista-del-carrito')
    anunciador.anunciar('Revisa lo que está marcado en la lista.')
    return
  }
  respuestas = {}
  avisoParaCorregir.value = null
  await intentar()
}

/** La fecha de "Otro día" falta o no vale: el panel se abre y el foco va a ese campo. */
async function revisarFecha(): Promise<void> {
  if (!esPC.value) expandido.value = true
  await enfocarPrimerError('.vista-recibir .cuando-fue')
}

async function intentar(): Promise<void> {
  if (registrando.value) return
  error.value = null
  const fecha = instanteDe(cuando.value)
  errorFecha.value = fecha.error
  if (fecha.error) {
    await revisarFecha()
    return
  }
  registrando.value = true
  try {
    const respuesta = await aplicacion.inventario.registrarIngreso({
      ...carrito.aDatosDeIngreso(),
      ...(fecha.instante ? { ocurridaEn: fecha.instante } : {}),
      ...respuestas,
    })
    if (respuesta.tipo === 'aviso-sobrecompra') {
      dialogo.value = { tipo: 'sobrecompra', avisos: respuesta.avisos }
    } else if (respuesta.tipo === 'confirmar-precios') {
      dialogo.value = { tipo: 'precios', cambios: respuesta.cambios }
    } else {
      registrada()
    }
  } catch (causa) {
    const mostrado = errorParaMostrar(causa, 'ingreso')
    errorFecha.value = errorDeFechaDelDominio(mostrado.codigo, mostrado.mensaje)
    if (errorFecha.value) await revisarFecha()
    else error.value = mostrado
  } finally {
    registrando.value = false
  }
}

/** RN-OP-20: "Registrar igual". */
function registrarIgual(): void {
  dialogo.value = null
  respuestas = { ...respuestas, confirmarSobrecompra: true }
  void intentar()
}

/** RN-OP-20: "Cambiar cantidad": no se registra nada; el foco va a la cantidad avisada. */
async function cambiarCantidad(): Promise<void> {
  const actual = dialogo.value
  dialogo.value = null
  if (actual?.tipo !== 'sobrecompra') return
  avisoParaCorregir.value = actual.avisos.map((a) => a.mensaje).join(' ')
  if (!esPC.value) expandido.value = true
  // Después de que el diálogo se cerró (al cerrarse, el navegador devuelve el foco al botón
  // que lo abrió): recién ahí el foco va al campo de la primera cantidad avisada.
  await nextTick()
  await new Promise((resolver) => setTimeout(resolver, 0))
  const primera = actual.avisos[0]?.productoId
  document
    .querySelector<HTMLElement>(`.lista-del-carrito [data-producto="${primera}"] .cantidad input`)
    ?.focus()
}

/**
 * r1 M1: cerrar la pregunta del precio con Escape o "atrás" del celular no la responde: no se
 * registra nada y se puede corregir un costo mal escrito.
 */
function cerrarPreguntaDePrecio(): void {
  dialogo.value = null
  respuestas = {}
}

/** RN-OP-14: la respuesta a "¿Actualizar el precio de compra…?" (las dos registran). */
function responderPrecio(actualizar: boolean): void {
  dialogo.value = null
  respuestas = { ...respuestas, actualizarPreciosDeCompra: actualizar }
  void intentar()
}

function registrada(): void {
  const copia = carrito.copia()
  const n = copia.lineas.length
  const valorTotal = textoTotal.value
  detalleDeExito.value = `${formatearEntero(n)} ${plural(n, 'producto', 'productos')} · Valor total ${valorTotal}`
  llegado.value = carrito.lineas.value.map((linea) => ({
    id: linea.id,
    nombre: linea.producto.nombre,
    detalle: linea.cantidadLeida
      ? `${formatearCantidad(linea.cantidadLeida, linea.producto.unidad)} × ${formatearDinero(linea.precio)}`
      : '',
    importe: linea.importe ? formatearDinero(linea.importe) : '',
    ...(linea.precioCambiado ? { marca: 'Costo nuevo' } : {}),
  }))
  carrito.vaciar()
  expandido.value = false
  respuestas = {}
  prellenada.value = null
  paso.value = 'exito'
  vibrar()
  // La lista ya se usó: recargar la pantalla no la vuelve a cargar.
  if (route.query.desde) void router.replace({ name: 'recibir' })
  deshacer.ofrecer(
    {
      mensaje: 'Mercadería registrada',
      alDeshacer: ({ pantallaAbierta }) => {
        const deshecha = `Deshiciste la llegada de mercadería (valor total ${valorTotal})`
        // r1 #2: si ya se está cargando otra llegada, no se toca; lo dice el resultado.
        if (!carrito.vacio.value) {
          return pantallaAbierta
            ? `${deshecha}. Lo que estás cargando sigue aquí.`
            : `${deshecha}. Lo que estabas cargando sigue en Llegó mercadería.`
        }
        carrito.restaurar(copia)
        if (pantallaAbierta) paso.value = 'carrito'
        return `${deshecha}. Los productos volvieron a la lista.`
      },
    },
    { enPantalla: true },
  )
}

async function otraLlegada(): Promise<void> {
  deshacer.cancelar()
  paso.value = 'carrito'
  await enfocarTitulo()
}

/** RN-AN-08: "Registrar llegada" de Para comprar abre esta pantalla con la lista de hoy. */
async function prellenarDesdeParaComprar(): Promise<void> {
  try {
    const lineas = await aplicacion.analisis.lineasParaRegistrarLlegada()
    const productos = await Promise.all(
      lineas.map((l) => aplicacion.catalogo.obtenerProducto(l.productoId)),
    )
    // r1 M9: lo que ya estaba cargado se queda; se agregan los productos de la lista.
    carrito.agregarFaltantes(
      lineas.flatMap((l, i) => {
        const producto = productos[i]
        return producto ? [{ producto, cantidad: l.cantidad, precio: l.costo }] : []
      }),
    )
    prellenada.value = lineas.length === 0 ? 'vacia' : 'con-lineas'
    // Como con el primer producto: en celular el panel aparece abierto, con el aviso adentro.
    if (lineas.length > 0 && !esPC.value) expandido.value = true
  } catch (causa) {
    error.value = errorParaMostrar(causa, 'ingreso')
  }
}

// Al abrirla desde Para comprar (también si ya estaba abierta: misma pantalla, otra consulta).
watch(
  () => route.query.desde,
  (desde) => {
    if (desde === 'para-comprar') void prellenarDesdeParaComprar()
  },
  { immediate: true },
)
</script>

<template>
  <div class="vista-recibir" :class="{ 'vista-recibir--con-panel': !esPC && paso === 'carrito' }">
    <PantallaExito
      v-if="paso === 'exito'"
      titulo="Mercadería registrada"
      :detalle="detalleDeExito"
      :segundos-para-deshacer="deshacer.restante.value"
      al-centro
      @deshacer="deshacer.deshacerAqui"
    >
      <ResumenDeLineas :lineas="llegado" etiqueta="Lo que llegó" />
      <BotonPrincipal
        class="accion-exito"
        texto="Registrar otra llegada"
        :icono="PackagePlus"
        @click="otraLlegada"
      />
    </PantallaExito>

    <template v-else>
      <EncabezadoPagina titulo="Llegó mercadería" />
      <!-- Con la hoja abierta (celular), los avisos de atrás tampoco se alcanzan. -->
      <div class="avisos" :inert="!esPC && expandido ? true : undefined">
        <AvisoEnPagina
          v-if="alDia.quitados.value.length > 0"
          tono="atencion"
          :titulo="alDia.textoDeQuitados.value"
          texto-cerrar="Cerrar"
          @cerrar="alDia.cerrarAviso"
        />
        <template v-if="esPC || prellenada === 'vacia'">
          <AvisoEnPagina
            v-if="prellenada === 'con-lineas'"
            tono="info"
            titulo="Cargamos tu lista para comprar de hoy"
            texto="Cambia lo que haga falta antes de registrar."
          />
          <AvisoEnPagina
            v-else-if="prellenada === 'vacia'"
            tono="info"
            titulo="Tu lista para comprar de hoy está vacía"
            texto="Busca los productos que llegaron."
          />
        </template>
        <template v-if="esPC">
          <AvisoEnPagina
            v-if="avisoParaCorregir"
            tono="atencion"
            titulo="Revisa la cantidad"
            :texto="avisoParaCorregir"
            texto-cerrar="Cerrar"
            @cerrar="avisoParaCorregir = null"
          />
          <MensajeDeError v-if="error" :mensaje="error.mensaje" :ayuda="error.ayuda" />
        </template>
      </div>

      <!-- PC: el carrito a la derecha del buscador. -->
      <DisposicionDeCarrito v-if="esPC" titulo-carrito="Lo que llegó">
        <template #buscador>
          <BuscadorDeProductos concepto="ingreso" @elegir="agregar" />
        </template>
        <template #carrito>
          <ListaDelCarrito
            :carrito="carrito"
            concepto="ingreso"
            texto-vacio="Toca un producto para agregarlo."
          />
          <CuandoFue
            v-if="!carrito.vacio.value"
            v-model="cuando"
            pregunta="¿Cuándo llegó?"
            :error="errorFecha"
          />
        </template>
        <template #total>
          <BarraDeTotal
            v-if="!carrito.vacio.value"
            etiqueta="Valor total"
            :texto-total="textoTotal"
            texto-accion="Registrar llegada"
            :icono="PackageCheck"
            :deshabilitado="registrando || carrito.hayEdicionAbierta.value"
            @accion="registrarLlegada"
          />
        </template>
      </DisposicionDeCarrito>

      <!-- Celular: la grilla ocupa la pantalla y el panel queda abajo, como en Vender. -->
      <template v-else>
        <div class="buscador" :inert="expandido ? true : undefined">
          <BuscadorDeProductos concepto="ingreso" @elegir="agregar" />
        </div>
        <PanelDeCarrito
          v-model:cuando="cuando"
          v-model:expandido="expandido"
          :carrito="carrito"
          concepto="ingreso"
          titulo="Lo que llegó"
          texto-accion="Registrar llegada"
          :icono="PackageCheck"
          etiqueta-total="Valor total"
          pregunta-fecha="¿Cuándo llegó?"
          :error-fecha="errorFecha"
          :texto-total="textoTotal"
          :registrando="registrando"
          @confirmar="registrarLlegada"
        >
          <template v-if="prellenada === 'con-lineas'" #arriba>
            <AvisoEnPagina
              tono="info"
              titulo="Cargamos tu lista para comprar de hoy"
              texto="Cambia lo que haga falta antes de registrar."
            />
          </template>
          <template v-if="avisoParaCorregir || error" #avisos>
            <AvisoEnPagina
              v-if="avisoParaCorregir"
              tono="atencion"
              titulo="Revisa la cantidad"
              :texto="avisoParaCorregir"
              texto-cerrar="Cerrar"
              @cerrar="avisoParaCorregir = null"
            />
            <MensajeDeError v-if="error" :mensaje="error.mensaje" :ayuda="error.ayuda" />
          </template>
        </PanelDeCarrito>
      </template>

      <DialogoConfirmacion
        :abierto="dialogo?.tipo === 'sobrecompra'"
        titulo="Revisa antes de registrar"
        :mensaje="dialogo?.tipo === 'sobrecompra' ? textoDelDialogo : ''"
        texto-confirmar="Registrar igual"
        texto-cancelar="Cambiar cantidad"
        @confirmar="registrarIgual"
        @cancelar="cambiarCantidad"
      />
      <DialogoConfirmacion
        :abierto="dialogo?.tipo === 'precios'"
        :titulo="tituloDePrecios"
        :mensaje="dialogo?.tipo === 'precios' ? textoDelDialogo : ''"
        texto-confirmar="Sí, actualizar"
        texto-cancelar="No, solo esta vez"
        enfocar="confirmar"
        cierre-nativo="cerrar"
        @confirmar="responderPrecio(true)"
        @cancelar="responderPrecio(false)"
        @cerrar="cerrarPreguntaDePrecio"
      />
    </template>
  </div>
</template>

<style scoped>
/* Celular: la pantalla llena el alto libre y el panel queda abajo, sobre la navegación. */
.vista-recibir--con-panel {
  display: flex;
  flex-direction: column;
  min-block-size: calc(100dvh - var(--alto-pie, 0px) - 2 * var(--espacio-4));
}
.vista-recibir--con-panel :deep(.panel-de-venta) {
  margin-block-start: auto;
}
.buscador {
  min-inline-size: 0;
}
.avisos {
  display: grid;
  gap: var(--espacio-3);
}
.avisos:not(:empty) {
  margin-bottom: var(--espacio-4);
}
.accion-exito {
  margin-top: var(--espacio-4);
  max-inline-size: 28rem;
}
</style>
