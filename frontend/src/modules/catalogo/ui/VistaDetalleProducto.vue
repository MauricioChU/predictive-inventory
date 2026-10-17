<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Archive, ArchiveRestore, ClipboardList, PackageMinus, Pencil } from 'lucide-vue-next'
import { resultadoDeDeshacerFallido, useAvisoDeshacer } from '@/app/aviso-deshacer'
import { useAplicacion } from '@/app/proveer-aplicacion'
import type { DetalleDeProducto } from '@/modules/analisis'
import type { OperacionVista } from '@/modules/inventario'
import { esErrorDeDominio } from '@/shared/domain/errores'
import { formatearCantidad, formatearDinero } from '@/shared/domain/formato'
import { useAnunciador } from '@/shared/ui/anunciador'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import Boton from '@/shared/ui/componentes/Boton.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import DialogoConfirmacion from '@/shared/ui/componentes/DialogoConfirmacion.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import FilaDeDato from '@/shared/ui/componentes/FilaDeDato.vue'
import FotoDeProducto from '@/shared/ui/componentes/FotoDeProducto.vue'
import GraficoBarras from '@/shared/ui/componentes/GraficoBarras.vue'
import InsigniaEstado from '@/shared/ui/componentes/InsigniaEstado.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import TarjetaDeCifra from '@/shared/ui/componentes/TarjetaDeCifra.vue'
import { hoyEnLaTienda } from '@/shared/domain/fecha'
import type { ProductoVista } from '../application/modulo'
import { NOMBRE_DE_UNIDAD } from '../domain/mensajes'
import { aPantalla } from './enlaces'
import { barrasDeTendencia, movimientoDeProducto, retiradoAlArchivar } from './presentacion'

const props = defineProps<{ id: string }>()

const REINTENTAR = 'Vuelve a intentarlo en un momento.'

/** Cuántos movimientos recientes se muestran (el historial completo está en Historial). */
const MOVIMIENTOS_A_LA_VISTA = 5

const app = useAplicacion()
const router = useRouter()
const aviso = useAvisoDeshacer()
const anunciador = useAnunciador()

const cargando = ref(true)
const producto = ref<ProductoVista | null>(null)
const detalle = ref<DetalleDeProducto | null>(null)
const operaciones = ref<OperacionVista[]>([])
const foto = ref<Blob | null>(null)
/** Mensaje de RN-CAT-11 mientras se pide confirmar el retiro del stock. */
const confirmacion = ref<string | null>(null)
/** RN-UX-11: lo que se acaba de hacer (visible y anunciado). */
const hecho = ref<{ titulo: string; texto?: string } | null>(null)
/** RN-UX-07: qué pasó y qué hacer. */
const error = ref<{ mensaje: string; ayuda: string } | null>(null)
const ocupado = ref(false)
const refAcciones = ref<HTMLElement>()
const refResultado = ref<HTMLElement>()
let montada = true
onBeforeUnmount(() => {
  montada = false
})

async function cargar() {
  const id = props.id
  const [vista, analisis, historial, imagen] = await Promise.all([
    app.catalogo.obtenerProducto(id),
    app.analisis.detalleDeProducto(id),
    app.inventario.historial({ productoId: id }),
    app.catalogo.obtenerFoto(id),
  ])
  if (!montada || id !== props.id) return
  producto.value = vista
  detalle.value = analisis
  operaciones.value = historial
  foto.value = imagen
  cargando.value = false
}

watch(
  () => props.id,
  () => {
    cargando.value = true
    hecho.value = null
    error.value = null
    confirmacion.value = null
    cargar().catch((e: unknown) => {
      console.error('No se pudo leer el producto:', e)
      error.value = { mensaje: 'No pudimos abrir este producto.', ayuda: REINTENTAR }
    })
  },
  { immediate: true },
)

const titulo = computed(() => {
  if (cargando.value) return 'Producto'
  return producto.value?.nombre ?? 'No encontramos ese producto'
})
const textoStock = computed(() =>
  producto.value ? formatearCantidad(producto.value.stock, producto.value.unidad) : '',
)
const porUnidad = computed(() => (producto.value ? NOMBRE_DE_UNIDAD[producto.value.unidad] : ''))

/** "Ganas por unidad" o, si el precio no deja ganancia, cuánto se pierde (RN-CAT-05). */
const ganancia = computed(() => {
  const p = producto.value
  if (!p) return null
  const valor = p.gananciaPorUnidad
  if (valor.esPositivo()) {
    return {
      etiqueta: `Ganas por ${porUnidad.value}`,
      texto: formatearDinero(valor),
      pierde: false,
    }
  }
  if (valor.esCero()) {
    return {
      etiqueta: `No ganas nada por ${porUnidad.value}`,
      texto: formatearDinero(valor),
      pierde: true,
    }
  }
  return {
    etiqueta: `Pierdes por ${porUnidad.value}`,
    texto: formatearDinero(valor.negar()),
    pierde: true,
  }
})

const barras = computed(() => {
  const p = producto.value
  const d = detalle.value
  if (!p || !d) return []
  return barrasDeTendencia(d.tendencia, p.unidad, hoyEnLaTienda(new Date()))
})
const huboVentas = computed(() => barras.value.some((b) => b.valor > 0))

const movimientos = computed(() => {
  const hoy = hoyEnLaTienda(new Date())
  return operaciones.value
    .slice(0, MOVIMIENTOS_A_LA_VISTA)
    .map((o) => movimientoDeProducto(o, props.id, hoy))
})

function irA(nombre: string) {
  void router.push(aPantalla(router, nombre, { id: props.id }))
}

function editar() {
  void router.push({ name: 'producto-editar', params: { id: props.id } })
}

/** Tras archivar o reactivar, el botón tocado desaparece: el foco pasa al que lo reemplaza. */
async function enfocarAccion() {
  await nextTick()
  refAcciones.value?.querySelector<HTMLElement>('button')?.focus()
}

function mostrarError(e: unknown) {
  if (esErrorDeDominio(e)) {
    error.value = { mensaje: e.message, ayuda: REINTENTAR }
    return
  }
  console.error('No se pudo cambiar el producto:', e)
  error.value = { mensaje: 'No pudimos guardar el cambio.', ayuda: REINTENTAR }
}

/** El resultado (junto a las acciones) recibe el foco: se ve y se oye donde está la persona. */
async function enfocarResultado() {
  await nextTick()
  refResultado.value?.focus()
}

/**
 * RN-CAT-10/11: archiva. Lo decide el caso de uso: si pide confirmar (queda stock), se muestra
 * su mensaje; confirmado, se retira el stock y se archiva en el mismo paso.
 */
async function archivar(confirmado = false) {
  const p = producto.value
  if (!p || ocupado.value) return
  ocupado.value = true
  error.value = null
  hecho.value = null
  let enfocar: (() => Promise<void>) | null = null
  try {
    // Lo que ya estaba en el historial: el retiro que informa es solo el de ESTE archivado.
    const anteriores = confirmado
      ? new Set((await app.inventario.historial({ productoId: p.id })).map((o) => o.id))
      : new Set<string>()
    const respuesta = await app.catalogo.archivarProducto({ productoId: p.id, confirmado })
    if (respuesta.tipo === 'confirmar') {
      confirmacion.value = respuesta.mensaje
      return
    }
    confirmacion.value = null
    await cargar()
    if (confirmado) {
      // Confirmado a propósito (RN-UX-08): no se ofrece Deshacer; esta es la única
      // confirmación, así que va junto a las acciones, con el foco y anunciada.
      const retirado = retiradoAlArchivar(operaciones.value, p.id, anteriores)
      hecho.value = {
        titulo: 'Producto archivado',
        ...(retirado ? { texto: `Retiramos ${retirado} del stock.` } : {}),
      }
      anunciador.anunciar([hecho.value.titulo, hecho.value.texto].filter(Boolean).join('. '))
      enfocar = enfocarResultado
    } else {
      hecho.value = null
      aviso.mostrar({
        mensaje: `Archivaste ${p.nombre}`,
        alDeshacer: () => void cambiarSinPreguntar(p.id, p.nombre, 'reactivar'),
      })
      enfocar = enfocarAccion
    }
  } catch (e) {
    confirmacion.value = null
    mostrarError(e)
    enfocar = enfocarResultado
  } finally {
    ocupado.value = false
  }
  // Recién ahora: mientras se guardaba, el botón nuevo estaba deshabilitado (no toma el foco).
  await enfocar?.()
}

async function reactivar() {
  const p = producto.value
  if (!p || ocupado.value) return
  ocupado.value = true
  error.value = null
  // Un aviso anterior (p. ej. "Producto archivado") ya no vale: si esto falla, se ve el error.
  hecho.value = null
  let enfocar: (() => Promise<void>) | null = null
  try {
    await app.catalogo.reactivarProducto(p.id)
    await cargar()
    aviso.mostrar({
      mensaje: `Reactivaste ${p.nombre}`,
      alDeshacer: () => void cambiarSinPreguntar(p.id, p.nombre, 'archivar'),
    })
    enfocar = enfocarAccion
  } catch (e) {
    mostrarError(e)
    enfocar = enfocarResultado
  } finally {
    ocupado.value = false
  }
  await enfocar?.()
}

/**
 * Deshacer: vuelve al estado anterior. Archivar otra vez puede pedir confirmar (llegó stock
 * mientras tanto): eso no se hace en silencio ni sin preguntar, se dice qué hacer.
 */
async function cambiarSinPreguntar(id: string, nombre: string, accion: 'archivar' | 'reactivar') {
  let noSePudo = false
  try {
    if (accion === 'reactivar') {
      await app.catalogo.reactivarProducto(id)
    } else {
      const respuesta = await app.catalogo.archivarProducto({ productoId: id })
      noSePudo = respuesta.tipo !== 'hecho'
    }
  } catch (e) {
    aviso.mostrarResultado(resultadoDeDeshacerFallido(e))
    return
  }
  // Plan 17 (RN-UX-11): lo que se deshizo (o por qué no se pudo) se ve y se anuncia donde se
  // ven todos los Deshacer, esté donde esté la persona, como en Vender y Recibir.
  if (noSePudo) {
    aviso.mostrarResultado({
      tono: 'atencion',
      titulo: 'No pudimos deshacer: el producto ya tiene stock.',
      texto: 'Si quieres archivarlo, toca «Archivar producto».',
    })
  } else {
    aviso.mostrarResultado({
      tono: 'exito',
      titulo:
        accion === 'reactivar'
          ? `Deshiciste archivar ${nombre}. Está activo otra vez.`
          : `Deshiciste reactivar ${nombre}. Quedó archivado otra vez.`,
    })
  }
  if (!montada || props.id !== id) return
  hecho.value = null
  try {
    await cargar()
  } catch (e) {
    console.error('No se pudo volver a leer el producto:', e)
  }
}
</script>

<template>
  <div class="vista-detalle-producto">
    <EncabezadoPagina :titulo="titulo" volver />
    <MensajeDeError v-if="error && cargando" :mensaje="error.mensaje" :ayuda="error.ayuda" />

    <template v-if="!cargando && !producto">
      <!-- Un enlace viejo (o una notificación) a un producto que ya no existe (01-catalogo). -->
      <p class="explicacion">Puede que ya no esté en tu lista. Búscalo entre tus productos.</p>
      <BotonPrincipal texto="Ver mis productos" @click="router.push({ name: 'productos' })" />
    </template>

    <template v-else-if="producto">
      <!-- Título corto: a 320 px con letra Muy grande entra al lado del ícono sin apretarse. -->
      <AvisoEnPagina
        v-if="!producto.activo"
        tono="info"
        titulo="Archivado"
        texto="Este producto no aparece en Vender, en Llegó mercadería ni en las alertas. Sus ventas pasadas siguen contando en tus reportes."
      />

      <div class="columnas">
        <div class="columna">
          <section class="resumen" aria-label="Stock">
            <FotoDeProducto
              class="foto"
              :imagen="foto ?? undefined"
              :nombre="producto.nombre"
              :categoria="producto.categoriaNombre"
              tamano="grande"
            />
            <div class="stock">
              <TarjetaDeCifra titulo="Tienes" :texto-valor="textoStock" />
              <InsigniaEstado
                v-if="producto.activo && detalle"
                :estado="detalle.situacion.estado"
              />
              <p v-if="producto.activo && detalle?.textoCobertura" class="cobertura">
                {{ detalle.textoCobertura }}
              </p>
              <p v-if="producto.activo && detalle?.textoVentaDiaria" class="venta-diaria">
                {{ detalle.textoVentaDiaria }}
              </p>
            </div>
          </section>

          <div v-if="producto.activo" class="acciones-de-stock">
            <Boton texto="Contar stock" :icono="ClipboardList" @click="irA('contar-stock')" />
            <Boton texto="Registrar pérdida" :icono="PackageMinus" @click="irA('merma')" />
          </div>

          <section class="seccion" aria-labelledby="titulo-datos">
            <h2 id="titulo-datos">Datos</h2>
            <FilaDeDato etiqueta="Categoría" :texto-valor="producto.categoriaNombre" />
            <FilaDeDato
              etiqueta="Stock mínimo"
              :texto-valor="formatearCantidad(producto.stockMinimo, producto.unidad)"
            />
          </section>

          <section class="seccion" aria-labelledby="titulo-precios">
            <h2 id="titulo-precios">Precios</h2>
            <FilaDeDato
              etiqueta="Precio de venta"
              :texto-valor="formatearDinero(producto.precioVenta)"
            />
            <FilaDeDato
              etiqueta="Precio de compra"
              :texto-valor="formatearDinero(producto.precioCompra)"
            />
            <FilaDeDato
              v-if="ganancia"
              :etiqueta="ganancia.etiqueta"
              :texto-valor="ganancia.texto"
              destacado
            />
            <AvisoEnPagina
              v-if="producto.activo && ganancia?.pierde"
              tono="atencion"
              :titulo="
                producto.gananciaPorUnidad.esCero()
                  ? 'Con este precio no ganas nada'
                  : 'Con este precio pierdes dinero'
              "
              texto="Revisa el precio de venta."
              texto-accion="Cambiar el precio"
              @accion="editar"
            />
          </section>
        </div>

        <div class="columna">
          <section v-if="producto.activo" class="seccion" aria-labelledby="titulo-ventas">
            <h2 id="titulo-ventas">Ventas</h2>
            <GraficoBarras v-if="huboVentas" titulo="Lo que vendiste por semana" :barras="barras" />
            <p v-else class="sin-datos">
              Todavía no hay ventas de este producto en estas 8 semanas.
            </p>
          </section>

          <section class="seccion" aria-labelledby="titulo-movimientos">
            <h2 id="titulo-movimientos">Últimos movimientos</h2>
            <template v-if="movimientos.length > 0">
              <FilaDeDato
                v-for="movimiento in movimientos"
                :key="movimiento.id"
                :etiqueta="`${movimiento.titulo} · ${movimiento.cuando}`"
                :texto-valor="movimiento.cantidad"
              />
            </template>
            <p v-else class="sin-datos">Todavía no tiene movimientos.</p>
          </section>
        </div>
      </div>

      <!-- RN-UX-11 / RN-UX-07: el resultado de archivar o reactivar va junto a las acciones
           (donde está la persona), no arriba de todo; recibe el foco y se anuncia. -->
      <div v-if="hecho || (error && !cargando)" ref="refResultado" class="resultado" tabindex="-1">
        <AvisoEnPagina v-if="hecho" tono="exito" :titulo="hecho.titulo" :texto="hecho.texto" />
        <MensajeDeError v-else-if="error" :mensaje="error.mensaje" :ayuda="error.ayuda" />
      </div>
      <div ref="refAcciones" class="acciones-finales">
        <template v-if="producto.activo">
          <BotonPrincipal texto="Editar producto" :icono="Pencil" @click="editar" />
          <Boton
            texto="Archivar producto"
            variante="peligro"
            :icono="Archive"
            :deshabilitado="ocupado"
            @click="archivar()"
          />
        </template>
        <BotonPrincipal
          v-else
          texto="Reactivar producto"
          :icono="ArchiveRestore"
          :deshabilitado="ocupado"
          @click="reactivar"
        />
      </div>

      <!-- RN-CAT-11 / RN-UX-08: archivar con stock es de las pocas cosas que se confirman. -->
      <DialogoConfirmacion
        :abierto="confirmacion !== null"
        titulo="¿Archivar este producto?"
        :mensaje="confirmacion ?? ''"
        texto-confirmar="Sí, retirar y archivar"
        texto-cancelar="No, dejarlo"
        peligro
        @confirmar="archivar(true)"
        @cancelar="confirmacion = null"
      />
    </template>
  </div>
</template>

<style scoped>
.vista-detalle-producto {
  display: grid;
  gap: var(--espacio-4);
  min-inline-size: 0;
}
.explicacion,
.sin-datos {
  margin: 0;
  color: var(--color-texto-suave);
}
.columnas,
.columna {
  display: grid;
  gap: var(--espacio-5);
  align-content: start;
  min-inline-size: 0;
}
.resumen {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--espacio-4);
}
.foto {
  --foto-lado: min(100%, 10rem);
}
.stock {
  display: grid;
  gap: var(--espacio-2);
  justify-items: start;
  flex: 1 1 12rem;
  min-inline-size: 0;
}
.cobertura,
.venta-diaria {
  margin: 0;
  font-size: 1.125rem;
}
.cobertura {
  font-weight: 700;
}
.acciones-de-stock {
  display: flex;
  flex-wrap: wrap;
  gap: var(--separacion-toque);
}
.acciones-de-stock > * {
  flex: 1 1 10rem;
}
.seccion {
  display: grid;
  gap: var(--espacio-2);
  min-inline-size: 0;
}
.seccion h2 {
  margin: 0;
  font-size: 1.2rem;
}
.acciones-finales {
  display: grid;
  gap: var(--espacio-3);
}
.resultado {
  scroll-margin-block: var(--espacio-4);
}
.resultado:focus {
  /* Foco programático (para que se lea), no interactivo: sin anillo. */
  outline: none;
}

/* Mismo corte que LayoutApp: en PC, stock y precios a la izquierda; ventas y movimientos a
   la derecha. Los botones finales, en una fila. */
@media (min-width: 1024px) {
  .columnas {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--espacio-6);
  }
  .acciones-finales {
    grid-template-columns: repeat(auto-fit, minmax(14rem, max-content));
    justify-content: end;
    align-items: center;
  }
}
</style>
