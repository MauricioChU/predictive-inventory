<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CalendarX2, Check, CircleHelp, Droplets, HeartCrack, Package } from 'lucide-vue-next'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { MOTIVOS_DE_MERMA, type MotivoDeMerma } from '@/shared/contratos/operaciones'
import { Cantidad } from '@/shared/domain/cantidad'
import { formatearCantidad, SIMBOLO_DE_UNIDAD } from '@/shared/domain/formato'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import BotonesDeOpcion from '@/shared/ui/componentes/BotonesDeOpcion.vue'
import CampoNumero from '@/shared/ui/componentes/CampoNumero.vue'
import CampoTexto from '@/shared/ui/componentes/CampoTexto.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import EstadoVacio from '@/shared/ui/componentes/EstadoVacio.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import PantallaExito from '@/shared/ui/componentes/PantallaExito.vue'
import ResumenDelProducto from './ResumenDelProducto.vue'
import { enfocarTitulo, vibrar } from './foco-y-respuesta'
import { errorParaMostrar, type ErrorParaMostrar } from './mensajes-de-error'
import { usarDeshacer } from './usar-deshacer'
import { usarDestinos } from './usar-destinos'
import { usarProductoDeLaRuta } from './usar-producto-de-la-ruta'

/**
 * Registrar merma (HU-OP-04, RN-OP-15): qué pasó (botones grandes: Se dañó o rompió · Se
 * derramó · Se venció · Otro, con nota obligatoria) y cuánto. Cuenta como pérdida; después,
 * pantalla de éxito con Deshacer (RN-OP-18).
 */
const aplicacion = useAplicacion()
const router = useRouter()
const destino = usarDestinos()
const deshacer = usarDeshacer()
const { producto, cargado, foto, usable, recargar, error: errorDeCarga } = usarProductoDeLaRuta()

const ICONOS: Record<MotivoDeMerma, typeof Droplets> = {
  'Se dañó o rompió': HeartCrack,
  'Se derramó': Droplets,
  'Se venció': CalendarX2,
  Otro: CircleHelp,
}
const OPCIONES = MOTIVOS_DE_MERMA.map((valor) => ({ valor, etiqueta: valor, icono: ICONOS[valor] }))

const motivo = ref<MotivoDeMerma | null>(null)
const cantidad = ref('1')
const nota = ref('')
const errorMotivo = ref<string>()
const errorCantidad = ref<string>()
const errorNota = ref<string>()
const errorGeneral = ref<ErrorParaMostrar | null>(null)
const registrando = ref(false)
const exito = ref<string | null>(null)
const deshecha = ref(false)

const porUnidades = computed(() => producto.value?.unidad === 'UNIDAD')
const etiquetaCantidad = computed(() =>
  producto.value ? `Cantidad (${SIMBOLO_DE_UNIDAD[producto.value.unidad]})` : 'Cantidad',
)

const CAMPO_DEL_ERROR: Record<string, 'motivo' | 'nota' | 'cantidad'> = {
  MOTIVO_REQUERIDO: 'motivo',
  NOTA_REQUERIDA: 'nota',
  NOTA_MUY_LARGA: 'nota',
  CANTIDAD_INVALIDA: 'cantidad',
  CANTIDAD_ENTERA: 'cantidad',
  CANTIDAD_DECIMALES: 'cantidad',
  CANTIDAD_NO_POSITIVA: 'cantidad',
  CANTIDAD_MAXIMA: 'cantidad',
  STOCK_INSUFICIENTE: 'cantidad',
}

function limpiarErrores(): void {
  errorMotivo.value = undefined
  errorCantidad.value = undefined
  errorNota.value = undefined
  errorGeneral.value = null
}

/** RN-UX-07: cada error del dominio junto a su campo; lo demás arriba del botón. */
function mostrarError(causa: unknown): void {
  const error = errorParaMostrar(causa, 'merma')
  const campo = error.codigo ? CAMPO_DEL_ERROR[error.codigo] : undefined
  const texto = error.ayuda ? `${error.mensaje}. ${error.ayuda}` : error.mensaje
  if (campo === 'motivo') errorMotivo.value = error.mensaje
  else if (campo === 'nota') errorNota.value = error.mensaje
  else if (campo === 'cantidad') errorCantidad.value = texto
  else errorGeneral.value = error
}

async function guardar(): Promise<void> {
  const actual = producto.value
  if (!actual || registrando.value) return
  registrando.value = true
  limpiarErrores()
  try {
    await aplicacion.inventario.registrarMerma({
      productoId: actual.id,
      cantidad: cantidad.value,
      motivo: motivo.value ?? '',
      nota: motivo.value === 'Otro' ? nota.value : undefined,
    })
  } catch (causa) {
    mostrarError(causa)
    registrando.value = false
    return
  }
  registrando.value = false
  const perdido = formatearCantidad(Cantidad.deTexto(cantidad.value, actual.unidad), actual.unidad)
  const queFue = `${motivo.value}: ${perdido} de ${actual.nombre}`
  await recargar()
  const ahora = producto.value ? formatearCantidad(producto.value.stock, actual.unidad) : ''
  // "8 unid." ya termina en punto: no se le agrega otro.
  exito.value = `${queFue}. Ahora hay ${ahora}${ahora.endsWith('.') ? '' : '.'}`
  deshecha.value = false
  vibrar()
  deshacer.ofrecer({
    mensaje: queFue,
    deshecho: 'Deshiciste lo que anotaste',
    alDeshacer: () => {
      void recargar()
      if (exito.value === null) return
      exito.value = null
      deshecha.value = true
      void enfocarTitulo()
    },
  })
}

function volverAlProducto(): void {
  void router.push(destino('producto', { id: producto.value?.id ?? '' }))
}
</script>

<template>
  <div class="vista-merma">
    <PantallaExito v-if="exito" titulo="Lo anotamos" :detalle="exito">
      <BotonPrincipal
        class="accion-exito"
        texto="Volver al producto"
        :icono="Package"
        @click="volverAlProducto"
      />
    </PantallaExito>

    <template v-else>
      <EncabezadoPagina titulo="Registrar merma" volver />
      <MensajeDeError
        v-if="errorDeCarga"
        :mensaje="errorDeCarga.mensaje"
        :ayuda="errorDeCarga.ayuda"
      />
      <EstadoVacio
        v-else-if="cargado && !producto"
        titulo="No encontramos ese producto"
        descripcion="Puede que lo hayan borrado. Búscalo en Productos."
        accion="Ir a Productos"
        @accion="router.push(destino('productos'))"
      />
      <EstadoVacio
        v-else-if="producto && !usable"
        :titulo="`${producto.nombre} está archivado. Reactívalo para usarlo`"
        accion="Ir a Productos"
        @accion="router.push(destino('productos'))"
      />
      <form v-else-if="producto" class="formulario" novalidate @submit.prevent="guardar">
        <AvisoEnPagina
          v-if="deshecha"
          tono="info"
          titulo="Deshiciste lo que anotaste"
          texto="El stock volvió a como estaba."
          texto-cerrar="Cerrar"
          @cerrar="deshecha = false"
        />
        <ResumenDelProducto :producto="producto" :foto="foto" prefijo-stock="Hay" />
        <BotonesDeOpcion
          v-model="motivo"
          :opciones="OPCIONES"
          etiqueta="¿Qué pasó?"
          :error="errorMotivo"
        />
        <CampoTexto
          v-if="motivo === 'Otro'"
          v-model="nota"
          etiqueta="Escribe qué pasó"
          :error="errorNota"
        />
        <CampoNumero
          v-model="cantidad"
          class="cantidad"
          :etiqueta="etiquetaCantidad"
          :decimales="!porUnidades"
          :minimo="porUnidades ? 1 : 0.001"
          :error="errorCantidad"
        />
        <MensajeDeError
          v-if="errorGeneral"
          :mensaje="errorGeneral.mensaje"
          :ayuda="errorGeneral.ayuda"
        />
        <MensajeDeError
          v-if="deshacer.error.value"
          :mensaje="deshacer.error.value.mensaje"
          :ayuda="deshacer.error.value.ayuda"
        />
        <BotonPrincipal texto="Guardar" tipo="submit" :icono="Check" :deshabilitado="registrando" />
      </form>
    </template>
  </div>
</template>

<style scoped>
.formulario {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-5);
  max-inline-size: 40rem;
}
.cantidad {
  max-inline-size: 22rem;
}
.accion-exito {
  margin-top: var(--espacio-4);
  max-inline-size: 28rem;
}
</style>
