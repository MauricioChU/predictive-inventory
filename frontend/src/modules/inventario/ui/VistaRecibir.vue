<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PackageCheck, PackagePlus } from 'lucide-vue-next'
import type { ProductoVista } from '@/modules/catalogo'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { formatearDinero, formatearEntero, plural } from '@/shared/domain/formato'
import { useAnunciador } from '@/shared/ui/anunciador'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import BarraDeTotal from '@/shared/ui/componentes/BarraDeTotal.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import DialogoConfirmacion from '@/shared/ui/componentes/DialogoConfirmacion.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import PantallaExito from '@/shared/ui/componentes/PantallaExito.vue'
import type { DatosDeIngreso } from '../application/ingresos'
import BuscadorDeProductos from './BuscadorDeProductos.vue'
import CuandoFue from './CuandoFue.vue'
import DisposicionDeCarrito from './DisposicionDeCarrito.vue'
import ListaDelCarrito from './ListaDelCarrito.vue'
import { usarCarrito } from './carrito-de-pantalla'
import { cuandoInicial, ERRORES_DE_FECHA, instanteDe } from './cuando'
import { enfocarPrimerError, enfocarTitulo, vibrar } from './foco-y-respuesta'
import { errorParaMostrar, type ErrorParaMostrar } from './mensajes-de-error'
import { usarDeshacer } from './usar-deshacer'
import { hoyEnLaTienda } from './usar-destinos'

/**
 * Llegó mercadería (HU-OP-03, HU-OP-09; en la navegación "Recibir"): igual que Vender, pero cada
 * línea lleva su costo editable. Al registrar, el caso de uso puede avisar una sobrecompra
 * (RN-OP-20, no bloquea) y preguntar si se actualiza el precio de compra (RN-OP-14, por defecto
 * sí). Con `?desde=para-comprar` arranca con la lista de hoy de Análisis (RN-AN-08).
 */
type Paso = 'carrito' | 'exito'
type Aviso = { productoId: string; mensaje: string }
type Dialogo = { tipo: 'sobrecompra'; avisos: Aviso[] } | { tipo: 'precios'; cambios: Aviso[] }
type Respuestas = Pick<DatosDeIngreso, 'confirmarSobrecompra' | 'actualizarPreciosDeCompra'>

const aplicacion = useAplicacion()
const anunciador = useAnunciador()
const route = useRoute()
const router = useRouter()
const carrito = usarCarrito('ingreso')
const deshacer = usarDeshacer()

const paso = ref<Paso>('carrito')
const registrando = ref(false)
const error = ref<ErrorParaMostrar | null>(null)
const dialogo = ref<Dialogo | null>(null)
/** Lo que la persona ya respondió en esta llegada (se manda en el siguiente intento). */
let respuestas: Respuestas = {}
/** "Cambiar cantidad": el aviso queda a la vista mientras corrige. */
const avisoParaCorregir = ref<string | null>(null)
const prellenada = ref<'con-lineas' | 'vacia' | null>(null)
const detalleDeExito = ref('')
const deshecha = ref(false)
/** RN-OP-09: la mercadería llegó ahora o otro día (hasta 7 días atrás). */
const cuando = ref(cuandoInicial(hoyEnLaTienda()))
const errorFecha = ref<string>()

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

function agregar(producto: ProductoVista): void {
  deshecha.value = false
  carrito.agregar(producto)
  anunciador.anunciar(`Agregaste ${producto.nombre}. Costo total ${textoTotal.value}`)
}

async function registrarLlegada(): Promise<void> {
  carrito.marcarVacias()
  if (carrito.hayErrores.value) {
    await enfocarPrimerError('.lista-del-carrito')
    anunciador.anunciar('Revisa lo que está marcado en la lista.')
    return
  }
  respuestas = {}
  avisoParaCorregir.value = null
  await intentar()
}

async function intentar(): Promise<void> {
  if (registrando.value) return
  error.value = null
  const fecha = instanteDe(cuando.value)
  errorFecha.value = fecha.error
  if (fecha.error) return
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
    if (mostrado.codigo && ERRORES_DE_FECHA.has(mostrado.codigo))
      errorFecha.value = mostrado.mensaje
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
  // Después de que el diálogo se cerró (al cerrarse, el navegador devuelve el foco al botón
  // que lo abrió): recién ahí el foco va al campo de la primera cantidad avisada.
  await nextTick()
  await new Promise((resolver) => setTimeout(resolver, 0))
  const primera = actual.avisos[0]?.productoId
  document
    .querySelector<HTMLElement>(`.lista-del-carrito [data-producto="${primera}"] .cantidad input`)
    ?.focus()
}

/** RN-OP-14: la respuesta a "¿Actualizar el precio de compra…?" (las dos registran). */
function responderPrecio(actualizar: boolean): void {
  dialogo.value = null
  respuestas = { ...respuestas, actualizarPreciosDeCompra: actualizar }
  void intentar()
}

function registrada(): void {
  const copia = carrito.copia()
  const n = copia.length
  detalleDeExito.value = `${formatearEntero(n)} ${plural(n, 'producto', 'productos')} · Costo total ${textoTotal.value}`
  carrito.vaciar()
  cuando.value = cuandoInicial(hoyEnLaTienda())
  respuestas = {}
  prellenada.value = null
  paso.value = 'exito'
  vibrar()
  // La lista ya se usó: recargar la pantalla no la vuelve a cargar.
  if (route.query.desde) void router.replace({ name: 'recibir' })
  deshacer.ofrecer({
    mensaje: 'Mercadería registrada',
    deshecho: 'Deshiciste la llegada de mercadería',
    alDeshacer: () => {
      if (!carrito.vacio.value) return
      carrito.restaurar(copia)
      deshecha.value = true
      paso.value = 'carrito'
      void enfocarTitulo()
    },
  })
}

async function otraLlegada(): Promise<void> {
  deshecha.value = false
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
    carrito.cargar(
      lineas.flatMap((l, i) => {
        const producto = productos[i]
        return producto ? [{ producto, cantidad: l.cantidad, precio: l.costo }] : []
      }),
    )
    prellenada.value = carrito.vacio.value ? 'vacia' : 'con-lineas'
  } catch (causa) {
    error.value = errorParaMostrar(causa, 'ingreso')
  }
}

onMounted(() => {
  if (route.query.desde === 'para-comprar') void prellenarDesdeParaComprar()
})
</script>

<template>
  <div class="vista-recibir">
    <PantallaExito v-if="paso === 'exito'" titulo="Mercadería registrada" :detalle="detalleDeExito">
      <BotonPrincipal
        class="accion-exito"
        texto="Registrar otra llegada"
        :icono="PackagePlus"
        @click="otraLlegada"
      />
    </PantallaExito>

    <template v-else>
      <EncabezadoPagina titulo="Llegó mercadería" />
      <div class="avisos">
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
        <AvisoEnPagina
          v-if="deshecha"
          tono="info"
          titulo="Deshiciste la llegada de mercadería"
          texto="Los productos siguen aquí por si quieres corregir algo."
          texto-cerrar="Cerrar"
          @cerrar="deshecha = false"
        />
        <AvisoEnPagina
          v-if="avisoParaCorregir"
          tono="atencion"
          titulo="Revisa la cantidad"
          :texto="avisoParaCorregir"
          texto-cerrar="Cerrar"
          @cerrar="avisoParaCorregir = null"
        />
        <MensajeDeError
          v-if="deshacer.error.value"
          :mensaje="deshacer.error.value.mensaje"
          :ayuda="deshacer.error.value.ayuda"
        />
        <MensajeDeError v-if="error" :mensaje="error.mensaje" :ayuda="error.ayuda" />
      </div>
      <DisposicionDeCarrito titulo-carrito="Lo que llegó">
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
            etiqueta="Costo total"
            :texto-total="textoTotal"
            texto-accion="Registrar llegada"
            :icono="PackageCheck"
            :deshabilitado="registrando"
            @accion="registrarLlegada"
          />
        </template>
      </DisposicionDeCarrito>

      <DialogoConfirmacion
        :abierto="dialogo?.tipo === 'sobrecompra'"
        titulo="¿Seguro que compras tanto?"
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
        @confirmar="responderPrecio(true)"
        @cancelar="responderPrecio(false)"
      />
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
.accion-exito {
  margin-top: var(--espacio-4);
  max-inline-size: 28rem;
}
</style>
