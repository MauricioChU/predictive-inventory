<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Archive, ArchiveRestore, ClipboardList, PackageMinus, Pencil } from 'lucide-vue-next'
import { useAvisoDeshacer } from '@/app/aviso-deshacer'
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
import type { ProductoVista } from '../application/modulo'
import { NOMBRE_DE_UNIDAD } from '../domain/mensajes'
import { aPantalla } from './enlaces'
import { barrasDeTendencia, hoyEnLaTienda, movimientoDeProducto } from './presentacion'

const props = defineProps<{ id: string }>()

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
const hecho = ref<{ titulo: string; texto: string } | null>(null)
const error = ref<string | null>(null)
const ocupado = ref(false)
const refAcciones = ref<HTMLElement>()
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
      error.value = 'No pudimos abrir este producto.'
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
  return barrasDeTendencia(d.tendencia, p.unidad, hoyEnLaTienda())
})
const huboVentas = computed(() => barras.value.some((b) => b.valor > 0))

const movimientos = computed(() => {
  const hoy = hoyEnLaTienda()
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
    error.value = e.message
    return
  }
  console.error('No se pudo cambiar el producto:', e)
  error.value = 'No pudimos guardar el cambio.'
}

/** RN-CAT-10/11: archiva; con stock, primero pide confirmar el retiro (AJUSTE hasta 0). */
async function archivar(confirmado = false) {
  const p = producto.value
  if (!p || ocupado.value) return
  ocupado.value = true
  error.value = null
  let cambio = false
  try {
    const retirado = p.stock.esPositiva() ? formatearCantidad(p.stock, p.unidad) : null
    const respuesta = await app.catalogo.archivarProducto({ productoId: p.id, confirmado })
    if (respuesta.tipo === 'confirmar') {
      confirmacion.value = respuesta.mensaje
      return
    }
    confirmacion.value = null
    await cargar()
    if (confirmado && retirado) {
      // Confirmado a propósito (RN-UX-08): no se ofrece Deshacer, se muestra lo que pasó.
      hecho.value = { titulo: 'Producto archivado', texto: `Retiramos ${retirado} del stock.` }
      anunciador.anunciar(`${hecho.value.titulo}. ${hecho.value.texto}`)
    } else {
      hecho.value = null
      aviso.mostrar({
        mensaje: `Archivaste ${p.nombre}`,
        alDeshacer: () => void cambiarSinPreguntar(p.id, 'reactivar'),
      })
    }
    cambio = true
  } catch (e) {
    confirmacion.value = null
    mostrarError(e)
  } finally {
    ocupado.value = false
  }
  // Recién ahora: mientras se guardaba, el botón nuevo estaba deshabilitado (no toma el foco).
  if (cambio) await enfocarAccion()
}

async function reactivar() {
  const p = producto.value
  if (!p || ocupado.value) return
  ocupado.value = true
  error.value = null
  let cambio = false
  try {
    await app.catalogo.reactivarProducto(p.id)
    hecho.value = null
    await cargar()
    aviso.mostrar({
      mensaje: `Reactivaste ${p.nombre}`,
      alDeshacer: () => void cambiarSinPreguntar(p.id, 'archivar'),
    })
    cambio = true
  } catch (e) {
    mostrarError(e)
  } finally {
    ocupado.value = false
  }
  if (cambio) await enfocarAccion()
}

/** Deshacer: vuelve al estado anterior (sin stock no hay nada que confirmar). */
async function cambiarSinPreguntar(id: string, accion: 'archivar' | 'reactivar') {
  try {
    if (accion === 'reactivar') await app.catalogo.reactivarProducto(id)
    else await app.catalogo.archivarProducto({ productoId: id })
    if (montada && props.id === id) {
      hecho.value = null
      await cargar()
    }
  } catch (e) {
    console.error('No se pudo deshacer:', e)
  }
}
</script>

<template>
  <div class="vista-detalle-producto">
    <EncabezadoPagina :titulo="titulo" volver />
    <MensajeDeError
      v-if="error && cargando"
      :mensaje="error"
      ayuda="Vuelve a intentarlo en un momento."
    />

    <template v-if="!cargando && !producto">
      <!-- Un enlace viejo (o una notificación) a un producto que ya no existe (01-catalogo). -->
      <p class="explicacion">Puede que ya no esté en tu lista. Búscalo entre tus productos.</p>
      <BotonPrincipal texto="Ver mis productos" @click="router.push({ name: 'productos' })" />
    </template>

    <template v-else-if="producto">
      <AvisoEnPagina v-if="hecho" tono="exito" :titulo="hecho.titulo" :texto="hecho.texto" />
      <AvisoEnPagina
        v-if="!producto.activo"
        tono="info"
        titulo="Este producto está archivado"
        texto="No aparece en Vender, en Llegó mercadería ni en las alertas. Sus ventas pasadas siguen contando en tus reportes."
      />
      <MensajeDeError v-if="error" :mensaje="error" ayuda="Vuelve a intentarlo en un momento." />

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
            <Boton texto="Registrar merma" :icono="PackageMinus" @click="irA('merma')" />
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
