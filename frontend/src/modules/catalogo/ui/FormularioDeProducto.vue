<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Camera, PackagePlus, Save } from 'lucide-vue-next'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { Cantidad, type Unidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { esErrorDeDominio } from '@/shared/domain/errores'
import { normalizar } from '@/shared/domain/texto'
import {
  formatearCantidad,
  formatearDinero,
  formatearNumero,
  SIMBOLO_DE_UNIDAD,
} from '@/shared/domain/formato'
import Boton from '@/shared/ui/componentes/Boton.vue'
import BotonesDeOpcion from '@/shared/ui/componentes/BotonesDeOpcion.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import CampoFoto from '@/shared/ui/componentes/CampoFoto.vue'
import CampoNumero from '@/shared/ui/componentes/CampoNumero.vue'
import CampoTexto from '@/shared/ui/componentes/CampoTexto.vue'
import DialogoConfirmacion from '@/shared/ui/componentes/DialogoConfirmacion.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import PantallaExito from '@/shared/ui/componentes/PantallaExito.vue'
import type { CategoriaVista } from '../application/modulo'
import { MENSAJE_UNIDAD_CON_MOVIMIENTOS, NOMBRE_DE_UNIDAD } from '../domain/mensajes'
import {
  campoDelError,
  erroresDeCampos,
  ORDEN_DE_CAMPOS,
  textoDeGanancia,
  type CampoDeProducto,
  type ErroresDeCampos,
  type ValoresDeProducto,
} from './formulario'
import { aPantalla } from './enlaces'
import { usarAltoObservado } from '@/shared/ui/alto-observado'
import { montoParaEditar } from './presentacion'

const props = withDefaults(
  defineProps<{
    /** Sin id se crea un producto nuevo; con id se edita ese. */
    productoId?: string
    /** Nombre ya escrito (p. ej. lo que se buscó en Productos sin encontrarlo). */
    nombreInicial?: string
    /** Se carga uno por uno desde Primera vez (plan 14): al guardar se ofrece "Seguir". */
    desdePrimeraVez?: boolean
    /** Dentro de una hoja inferior (Productos → "Agregar producto"): sin encabezado ni "Volver"
     * (la hoja ya tiene el suyo), el botón de guardar pegado al fondo de la hoja y, al terminar,
     * "Ver producto" abre el detalle en vez de reemplazar la pantalla. */
    enHoja?: boolean
  }>(),
  { productoId: undefined, nombreInicial: '', desdePrimeraVez: false, enHoja: false },
)
const emit = defineEmits<{ agregarOtro: []; guardado: [] }>()

/** Mínimo sugerido en el formulario (01-catalogo, modelo de Producto). */
const STOCK_MINIMO_SUGERIDO = '3'

const OPCIONES_DE_UNIDAD: readonly { valor: Unidad; etiqueta: string }[] = [
  { valor: 'UNIDAD', etiqueta: 'Por unidad' },
  { valor: 'KILO', etiqueta: 'Por kilo' },
  { valor: 'LITRO', etiqueta: 'Por litro' },
]

const app = useAplicacion()
const router = useRouter()
const editando = computed(() => props.productoId !== undefined)

const cargando = ref(true)
const existe = ref(true)
const categorias = ref<CategoriaVista[]>([])
const valores = reactive<ValoresDeProducto>({
  nombre: props.nombreInicial,
  categoriaId: null,
  unidad: 'UNIDAD',
  precioCompra: '',
  precioVenta: '',
  stockMinimo: STOCK_MINIMO_SUGERIDO,
  stockInicial: '0',
})
/** Los precios como llegaron (al editar): si no cambian, no se vuelven a confirmar. */
const preciosOriginales = { compra: '', venta: '' }
/** RN-CAT-03: al editar, con movimientos la unidad queda fija. */
const unidadFija = ref(false)
const foto = ref<Blob | null>(null)
const fotoCambiada = ref(false)

const errores = ref<ErroresDeCampos>({})
/** Ayuda bajo el error de la foto (qué pasó con lo demás). */
const ayudaFoto = ref<string | undefined>()
const errorGeneral = ref<string | null>(null)
const ocupado = ref(false)

/** RN-CAT-05: el mensaje de pérdida mientras se pide confirmar. */
const confirmacionDePerdida = ref<string | null>(null)
/** RN-CAT-02: el archivado con el mismo nombre. */
const ofertaDeReactivar = ref<{ productoId: string; nombre: string } | null>(null)

type Exito =
  | { tipo: 'creado'; productoId: string; detalle: string; errorFoto: string | null }
  | { tipo: 'reactivado'; productoId: string; detalle: string }
  | { tipo: 'editado'; productoId: string; detalle: string }
const exito = ref<Exito | null>(null)

const refRaiz = ref<HTMLElement>()
const refFormulario = ref<HTMLFormElement>()
const refAccion = ref<HTMLElement>()
/** Alto real del botón pegado abajo: lo que recibe el foco se queda por encima (WCAG 2.4.11). */
const altoDeLaAccion = usarAltoObservado(refAccion)
// En una hoja, la confirmación empieza desde arriba (el cuerpo de la hoja es lo que se desplaza).
watch(exito, (nuevo) => {
  if (nuevo && nuevo.tipo !== 'editado') emit('guardado')
  if (!nuevo || !props.enHoja) return
  void nextTick(() => {
    const cuerpo = refRaiz.value?.closest('.cuerpo')
    if (cuerpo) cuerpo.scrollTop = 0
  })
})
let montado = true
onBeforeUnmount(() => {
  montado = false
})

async function cargar() {
  const [lista, producto, historial, imagen] = await Promise.all([
    app.catalogo.listarCategorias(),
    props.productoId ? app.catalogo.obtenerProducto(props.productoId) : null,
    props.productoId ? app.inventario.historial({ productoId: props.productoId }) : [],
    props.productoId ? app.catalogo.obtenerFoto(props.productoId) : null,
  ])
  if (!montado) return
  categorias.value = lista
  if (props.productoId) {
    if (!producto) {
      existe.value = false
    } else {
      valores.nombre = producto.nombre
      valores.categoriaId = producto.categoriaId
      valores.unidad = producto.unidad
      valores.precioCompra = montoParaEditar(producto.precioCompra)
      valores.precioVenta = montoParaEditar(producto.precioVenta)
      valores.stockMinimo = formatearNumero(producto.stockMinimo)
      preciosOriginales.compra = valores.precioCompra
      preciosOriginales.venta = valores.precioVenta
      unidadFija.value = historial.length > 0
      foto.value = imagen
    }
  }
  cargando.value = false
}
cargar().catch((error: unknown) => {
  console.error('No se pudo leer el producto:', error)
  errorGeneral.value = 'No pudimos abrir el formulario.'
})

const titulo = computed(() => {
  if (!existe.value) return 'No encontramos ese producto'
  return editando.value ? 'Editar producto' : 'Producto nuevo'
})
const porUnidad = computed(() => NOMBRE_DE_UNIDAD[valores.unidad])
const simbolo = computed(() => SIMBOLO_DE_UNIDAD[valores.unidad])
const conDecimales = computed(() => valores.unidad !== 'UNIDAD')
const opcionesDeCategoria = computed(() =>
  categorias.value.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
)
const nombreDeLaUnidad = computed(
  () => OPCIONES_DE_UNIDAD.find((o) => o.valor === valores.unidad)?.etiqueta ?? '',
)
const nombreDeCategoria = computed(
  () => categorias.value.find((c) => c.id === valores.categoriaId)?.nombre,
)
const ganancia = computed(() =>
  textoDeGanancia(valores.precioCompra, valores.precioVenta, valores.unidad),
)

/** Al cambiar un campo, su error (ya viejo) se va. */
function limpiar(...campos: CampoDeProducto[]) {
  const siguientes = { ...errores.value }
  for (const c of campos) delete siguientes[c]
  errores.value = siguientes
}

function cambiar<K extends keyof ValoresDeProducto>(
  clave: K,
  valor: ValoresDeProducto[K],
  ...campos: CampoDeProducto[]
) {
  valores[clave] = valor
  limpiar(...campos)
}

function alCambiarFoto(nueva: Blob | null) {
  foto.value = nueva
  fotoCambiada.value = true
  ayudaFoto.value = undefined
  limpiar('foto')
}

function alErrorDeFoto(mensaje: string) {
  ayudaFoto.value = undefined
  errores.value = { ...errores.value, foto: mensaje }
}

/**
 * Lleva el foco al campo (al primero con error, o al que hay que corregir): a su campo de
 * texto, o a la opción enfocable del grupo. Espera a que un diálogo que se está cerrando
 * termine de cerrarse: mientras está abierto lo de afuera es inerte y, al cerrarse, el
 * navegador devuelve el foco a donde estaba antes.
 */
async function enfocar(campo: CampoDeProducto) {
  await nextTick()
  await new Promise((listo) => setTimeout(listo, 0))
  const contenedor = refFormulario.value?.querySelector<HTMLElement>(`[data-campo="${campo}"]`)
  const destino = ['input:not([type="file"])', '[role="radio"][tabindex="0"]', 'button']
    .map((selector) => contenedor?.querySelector<HTMLElement>(selector))
    .find((el) => el)
  destino?.focus()
}

function mostrarErrores(nuevos: ErroresDeCampos) {
  errores.value = nuevos
  const primero = ORDEN_DE_CAMPOS.find((c) => nuevos[c] !== undefined)
  if (primero) void enfocar(primero)
}

function mostrarFallo(error: unknown) {
  if (esErrorDeDominio(error)) {
    const campo = campoDelError(error.codigo)
    if (campo) {
      mostrarErrores({ ...errores.value, [campo]: error.message })
      return
    }
    errorGeneral.value = error.message
    return
  }
  console.error('No se pudo guardar el producto:', error)
  errorGeneral.value = 'No pudimos guardar el producto.'
}

const preciosCambiaron = () =>
  valores.precioCompra !== preciosOriginales.compra ||
  valores.precioVenta !== preciosOriginales.venta

/** RN-CAT-14: guarda o quita la foto con el caso de uso del catálogo (que la reduce). */
async function guardarFotoDe(productoId: string): Promise<string | null> {
  if (!fotoCambiada.value) return null
  try {
    if (foto.value) await app.catalogo.guardarFoto(productoId, foto.value)
    else await app.catalogo.quitarFoto(productoId)
    fotoCambiada.value = false
    return null
  } catch (error) {
    if (esErrorDeDominio(error)) return error.message
    throw error
  }
}

async function crear(confirmado: boolean) {
  const respuesta = await app.catalogo.crearProducto({
    nombre: valores.nombre,
    categoriaId: valores.categoriaId ?? '',
    unidad: valores.unidad,
    precioCompra: valores.precioCompra,
    precioVenta: valores.precioVenta,
    stockMinimo: valores.stockMinimo,
    stockInicial: valores.stockInicial,
    confirmado,
  })
  if (respuesta.tipo === 'confirmar') {
    confirmacionDePerdida.value = respuesta.mensaje
    return
  }
  if (respuesta.tipo === 'reactivar') {
    ofertaDeReactivar.value = { productoId: respuesta.productoId, nombre: respuesta.nombre }
    return
  }
  const productoId = respuesta.valor.productoId
  const errorFoto = await guardarFotoDe(productoId)
  const inicial = Cantidad.deTexto(valores.stockInicial.trim() || '0', valores.unidad)
  const nombre = valores.nombre.trim()
  // "unid." ya termina en punto: no se agrega otro.
  const stock = formatearCantidad(inicial, valores.unidad)
  const detalle = inicial.esPositiva()
    ? `${nombre} ya está en tu lista con ${stock}${stock.endsWith('.') ? '' : '.'}`
    : `${nombre} ya está en tu lista.`
  exito.value = { tipo: 'creado', productoId, detalle, errorFoto }
}

async function editar(productoId: string, confirmado: boolean) {
  const respuesta = await app.catalogo.editarProducto({
    productoId,
    nombre: valores.nombre,
    categoriaId: valores.categoriaId ?? '',
    ...(unidadFija.value ? {} : { unidad: valores.unidad }),
    ...(preciosCambiaron()
      ? { precioCompra: valores.precioCompra, precioVenta: valores.precioVenta }
      : {}),
    stockMinimo: valores.stockMinimo,
    confirmado,
  })
  if (respuesta.tipo === 'confirmar') {
    confirmacionDePerdida.value = respuesta.mensaje
    return
  }
  preciosOriginales.compra = valores.precioCompra
  preciosOriginales.venta = valores.precioVenta
  const errorFoto = await guardarFotoDe(productoId)
  if (errorFoto) {
    ayudaFoto.value = 'Los demás cambios ya quedaron guardados.'
    mostrarErrores({ foto: errorFoto })
    return
  }
  exito.value = {
    tipo: 'editado',
    productoId,
    // Ya validado: el precio se lee igual que lo leyó el caso de uso.
    detalle: `${valores.nombre.trim()} se vende a ${formatearDinero(Dinero.deTexto(valores.precioVenta))} por ${porUnidad.value}.`,
  }
}

async function guardar(confirmado = false) {
  if (ocupado.value) return
  errorGeneral.value = null
  confirmacionDePerdida.value = null
  const encontrados = erroresDeCampos(valores, { conStockInicial: !editando.value })
  const errorDeFoto = errores.value.foto
  if (Object.keys(encontrados).length > 0) {
    const todos = { ...encontrados, ...(errorDeFoto ? { foto: errorDeFoto } : {}) }
    // RN-CAT-02: si el nombre es de un archivado, primero se ofrece reactivarlo (lo demás que
    // falte por escribir se descartaría). Los errores quedan a la vista por si dice que no.
    ocupado.value = true
    const archivado =
      !editando.value && !encontrados.nombre ? await archivadoConEseNombre(valores.nombre) : null
    ocupado.value = false
    if (archivado) {
      errores.value = todos
      ofertaDeReactivar.value = archivado
      return
    }
    mostrarErrores(todos)
    return
  }
  errores.value = errorDeFoto && !fotoCambiada.value ? { foto: errorDeFoto } : {}
  ocupado.value = true
  try {
    if (props.productoId) await editar(props.productoId, confirmado)
    else await crear(confirmado)
  } catch (error) {
    mostrarFallo(error)
  } finally {
    ocupado.value = false
  }
}

/** Un producto archivado cuyo nombre es el escrito (misma comparación que RN-CAT-01). */
async function archivadoConEseNombre(
  nombre: string,
): Promise<{ productoId: string; nombre: string } | null> {
  try {
    const buscado = normalizar(nombre)
    const archivados = await app.catalogo.buscarProductos({ texto: nombre, archivados: true })
    const igual = archivados.find((p) => normalizar(p.nombre) === buscado)
    return igual ? { productoId: igual.id, nombre: igual.nombre } : null
  } catch (error) {
    console.error('No se pudo buscar entre los archivados:', error)
    return null
  }
}

function cambiarElPrecio() {
  confirmacionDePerdida.value = null
  void enfocar('precioVenta')
}

async function reactivar() {
  const oferta = ofertaDeReactivar.value
  if (!oferta) return
  ofertaDeReactivar.value = null
  try {
    await app.catalogo.reactivarProducto(oferta.productoId)
    exito.value = {
      tipo: 'reactivado',
      productoId: oferta.productoId,
      detalle: `${oferta.nombre} vuelve a aparecer en Vender y en Llegó mercadería.`,
    }
  } catch (error) {
    mostrarFallo(error)
  }
}

function cambiarElNombre() {
  ofertaDeReactivar.value = null
  void enfocar('nombre')
}

function verProducto(productoId: string) {
  const detalle = router.resolve({ name: 'producto', params: { id: productoId } }).fullPath
  if (props.enHoja) {
    void router.push(detalle)
    return
  }
  // Si se vino del detalle, se vuelve a él (sin dejar dos veces el detalle en el historial).
  if (router.options.history.state.back === detalle) router.back()
  else void router.replace(detalle)
}
</script>

<template>
  <div ref="refRaiz" class="formulario-de-producto" :class="{ 'en-hoja': enHoja }">
    <!-- Al centro como todas las confirmaciones, pero con sus botones: se centra el conjunto. -->
    <div v-if="exito" class="exito-centrado">
      <PantallaExito
        :al-centro="false"
        :titulo="
          exito.tipo === 'creado'
            ? 'Producto guardado'
            : exito.tipo === 'reactivado'
              ? 'Producto reactivado'
              : 'Cambios guardados'
        "
        :detalle="exito.detalle"
      />
      <!-- Fuera del recuadro centrado de PantallaExito: con todo el ancho de la pantalla, el
           texto de los botones entra por palabras enteras (320 px con letra Muy grande). -->
      <div class="despues">
        <template v-if="exito.tipo === 'creado' && exito.errorFoto">
          <!-- RN-UX-16: en la primera vez no hay a dónde ir (el detalle y la edición del producto
               vuelven a la bienvenida): sin "Agregar foto" ni "Ver producto". -->
          <MensajeDeError
            :mensaje="exito.errorFoto"
            :ayuda="
              desdePrimeraVez
                ? 'El producto quedó guardado sin foto. Puedes agregársela después, desde Productos.'
                : 'El producto quedó guardado sin foto. Puedes agregarle otra.'
            "
          />
          <Boton
            v-if="!desdePrimeraVez"
            texto="Agregar foto"
            :icono="Camera"
            @click="
              router[enHoja ? 'push' : 'replace']({
                name: 'producto-editar',
                params: { id: exito.productoId },
              })
            "
          />
        </template>
        <template v-if="exito.tipo === 'editado'">
          <BotonPrincipal texto="Ver producto" @click="verProducto(exito.productoId)" />
        </template>
        <template v-else>
          <BotonPrincipal
            texto="Agregar otro producto"
            :icono="PackagePlus"
            @click="emit('agregarOtro')"
          />
          <!-- Contrato de rutas (ronda 1, ruling B): Primera vez sigue con "Ahora contemos lo
               que tienes" (plan 14). -->
          <Boton
            v-if="desdePrimeraVez"
            texto="Seguir"
            :icono="ArrowRight"
            @click="router.push(aPantalla(router, 'primera-vez', {}, { paso: 'contar' }))"
          />
          <Boton
            v-if="!desdePrimeraVez"
            texto="Ver producto"
            @click="verProducto(exito.productoId)"
          />
        </template>
      </div>
    </div>

    <template v-else>
      <EncabezadoPagina v-if="!enHoja" :titulo="titulo" volver />

      <MensajeDeError
        v-if="errorGeneral && cargando"
        :mensaje="errorGeneral"
        ayuda="Vuelve a intentarlo en un momento."
      />

      <template v-if="!existe">
        <p class="explicacion">Puede que ya no esté en tu lista. Búscalo entre tus productos.</p>
        <BotonPrincipal texto="Ver mis productos" @click="router.push({ name: 'productos' })" />
      </template>

      <form
        v-else-if="!cargando"
        ref="refFormulario"
        class="campos"
        :style="{ '--alto-accion': `${altoDeLaAccion}px` }"
        novalidate
        @submit.prevent="guardar()"
      >
        <MensajeDeError
          v-if="errorGeneral"
          :mensaje="errorGeneral"
          ayuda="Revisa los datos y vuelve a intentarlo."
        />

        <div data-campo="nombre">
          <CampoTexto
            :model-value="valores.nombre"
            etiqueta="Nombre del producto"
            autocompletar="off"
            :error="errores.nombre"
            @update:model-value="cambiar('nombre', $event, 'nombre')"
          />
        </div>

        <div data-campo="foto" class="campo-foto">
          <CampoFoto
            :model-value="foto"
            etiqueta="Foto del producto"
            :nombre="valores.nombre.trim() || undefined"
            :categoria="nombreDeCategoria"
            @update:model-value="alCambiarFoto"
            @error="alErrorDeFoto"
          />
          <MensajeDeError v-if="errores.foto" :mensaje="errores.foto" :ayuda="ayudaFoto" />
        </div>

        <div data-campo="categoria" class="campo-categoria">
          <BotonesDeOpcion
            :model-value="valores.categoriaId"
            :opciones="opcionesDeCategoria"
            etiqueta="¿De qué categoría es?"
            :error="errores.categoria"
            @update:model-value="cambiar('categoriaId', $event, 'categoria')"
          />
        </div>

        <div data-campo="unidad">
          <div v-if="unidadFija" class="unidad-fija">
            <p class="etiqueta">¿Cómo se vende?</p>
            <p class="valor-fijo">{{ nombreDeLaUnidad }}</p>
            <p class="nota">{{ MENSAJE_UNIDAD_CON_MOVIMIENTOS }}</p>
          </div>
          <BotonesDeOpcion
            v-else
            :model-value="valores.unidad"
            :opciones="OPCIONES_DE_UNIDAD"
            etiqueta="¿Cómo se vende?"
            :error="errores.unidad"
            @update:model-value="cambiar('unidad', $event, 'unidad', 'stockMinimo', 'stockInicial')"
          />
        </div>

        <div class="precios">
          <div data-campo="precioCompra">
            <CampoNumero
              :model-value="valores.precioCompra"
              :etiqueta="`Precio de compra por ${porUnidad} (S/)`"
              decimales
              :paso="0.1"
              :error="errores.precioCompra"
              @update:model-value="cambiar('precioCompra', $event, 'precioCompra')"
            />
          </div>
          <div data-campo="precioVenta">
            <CampoNumero
              :model-value="valores.precioVenta"
              :etiqueta="`Precio de venta por ${porUnidad} (S/)`"
              decimales
              :paso="0.1"
              :error="errores.precioVenta"
              @update:model-value="cambiar('precioVenta', $event, 'precioVenta')"
            />
          </div>
          <p v-if="ganancia" class="ganancia">{{ ganancia }}</p>
        </div>

        <div data-campo="stockMinimo">
          <CampoNumero
            :model-value="valores.stockMinimo"
            etiqueta="Stock mínimo"
            :decimales="conDecimales"
            :sufijo="simbolo"
            :error="errores.stockMinimo"
            @update:model-value="cambiar('stockMinimo', $event, 'stockMinimo')"
          />
          <p class="nota">Cuando quede esta cantidad o menos, te avisamos que queda poco.</p>
        </div>

        <div v-if="!editando" data-campo="stockInicial">
          <CampoNumero
            :model-value="valores.stockInicial"
            etiqueta="¿Cuántos tienes ahora?"
            :decimales="conDecimales"
            :sufijo="simbolo"
            :error="errores.stockInicial"
            @update:model-value="cambiar('stockInicial', $event, 'stockInicial')"
          />
        </div>

        <div ref="refAccion" class="accion-principal">
          <BotonPrincipal
            tipo="submit"
            :texto="editando ? 'Guardar cambios' : 'Guardar producto'"
            :icono="Save"
            :deshabilitado="ocupado"
          />
        </div>
      </form>

      <!-- RN-CAT-05 / RN-UX-08: un precio con pérdida se confirma mostrando cuánto se pierde. -->
      <DialogoConfirmacion
        :abierto="confirmacionDePerdida !== null"
        titulo="¿Guardar con este precio?"
        :mensaje="confirmacionDePerdida ?? ''"
        texto-confirmar="Sí, guardar así"
        texto-cancelar="Cambiar el precio"
        @confirmar="guardar(true)"
        @cancelar="cambiarElPrecio"
      />
      <!-- RN-CAT-02: el nombre es de un producto archivado: no se crea otro, se reactiva. -->
      <DialogoConfirmacion
        :abierto="ofertaDeReactivar !== null"
        titulo="Ya tenías este producto"
        :mensaje="`${ofertaDeReactivar?.nombre ?? ''} está archivado. ¿Quieres reactivarlo? Vuelve con sus precios de antes.`"
        texto-confirmar="Sí, reactivarlo"
        texto-cancelar="No, cambiar el nombre"
        @confirmar="reactivar"
        @cancelar="cambiarElNombre"
      />
    </template>
  </div>
</template>

<style scoped>
.exito-centrado {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: calc(100dvh - var(--alto-pie, 0px) - 2 * var(--espacio-4));
}
.en-hoja .exito-centrado {
  min-block-size: 0;
  padding-block: var(--espacio-4);
}
.formulario-de-producto {
  display: grid;
  gap: var(--espacio-4);
  min-inline-size: 0;
  max-inline-size: 46rem;
}
.explicacion {
  margin: 0;
  color: var(--color-texto-suave);
}
.campos {
  display: grid;
  gap: var(--espacio-5);
  min-inline-size: 0;
}
.campos > *,
.precios > * {
  min-inline-size: 0;
}
.campo-foto,
.precios {
  display: grid;
  gap: var(--espacio-3);
}
.ganancia {
  margin: 0;
  font-weight: 700;
}
.nota {
  margin: var(--espacio-2) 0 0;
  color: var(--color-texto-suave);
}
.unidad-fija .etiqueta {
  margin: 0 0 var(--espacio-2);
  font-weight: 700;
}
.valor-fijo {
  margin: 0;
  font-size: 1.125rem;
}
/* Con espacio, las categorías van en dos o más columnas (son diez opciones). */
@media (min-width: 600px) {
  .campo-categoria :deep(.opciones) {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
  }
}
.accion-principal {
  padding-block: var(--espacio-2);
}
/* 06 (responsive): en celular el botón principal va fijo abajo, sobre la navegación (como
   "Agregar producto" en la lista); desde 1024 px queda al final del formulario. Los campos
   dejan su lugar al enfocarse para que el botón nunca los tape (WCAG 2.4.11). */
@media (max-width: 1023px) {
  .accion-principal {
    position: sticky;
    bottom: var(--alto-pie, 0px);
    z-index: 5;
    padding-block: var(--espacio-3);
    background: var(--color-fondo);
    box-shadow: var(--sombra-flotante);
  }
  .campos :deep(:is(button, input, a)) {
    scroll-margin-bottom: calc(var(--alto-accion, 0px) + var(--espacio-3));
  }
}
.despues {
  display: grid;
  gap: var(--espacio-3);
}
/* En la hoja: el botón queda pegado al fondo de la hoja (que ya está sobre la navegación), en
   cualquier ancho; absorbe el relleno de abajo del cuerpo para no dejar un hueco. */
.en-hoja .accion-principal {
  position: sticky;
  /* El offset se mide desde el relleno del cuerpo de la hoja: se cancela para quedar al ras. */
  bottom: calc(-1 * var(--espacio-4));
  z-index: 5;
  margin-block-end: calc(-1 * var(--espacio-4));
  padding-block: var(--espacio-3);
  background: var(--color-superficie);
  box-shadow: var(--sombra-flotante);
}
.en-hoja .campos :deep(:is(button, input, a)) {
  scroll-margin-bottom: calc(var(--alto-accion, 0px) + var(--espacio-3));
}
</style>
