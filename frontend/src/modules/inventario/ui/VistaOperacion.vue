<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Ban, History } from 'lucide-vue-next'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { diaDe, horaDe } from '@/shared/domain/fecha'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import DialogoConfirmacion from '@/shared/ui/componentes/DialogoConfirmacion.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import EstadoVacio from '@/shared/ui/componentes/EstadoVacio.vue'
import FilaDeDato from '@/shared/ui/componentes/FilaDeDato.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import PantallaExito from '@/shared/ui/componentes/PantallaExito.vue'
import { etiquetaDeDia } from '@/shared/ui/etiquetas-de-dia'
import type { OperacionVista } from '../application/historial'
import { enfocarTitulo } from './foco-y-respuesta'
import { errorParaMostrar, type ErrorParaMostrar } from './mensajes-de-error'
import { cuentaDeLinea, nombreConArticulo, totalesDe } from './presentacion-de-operaciones'
import { hoyEnLaTienda } from './usar-destinos'

/**
 * Detalle de una operación del Historial y **Anular** (RN-OP-02, RN-OP-17): invierte todos sus
 * movimientos, una sola vez, nunca sobre una anulación, y se rechaza si dejaría stock negativo
 * (el mensaje del dominio se muestra tal cual, con qué hacer). Una anulación no se puede
 * deshacer (ni anular): por eso, y solo aquí, se confirma antes con un resumen claro
 * (principio 2 de 06-experiencia-de-uso).
 */
const aplicacion = useAplicacion()
const route = useRoute()
const router = useRouter()

const operacion = ref<OperacionVista | null>(null)
/** La que anuló esta (si esta es una anulación). */
const original = ref<OperacionVista | null>(null)
const cargado = ref(false)
const confirmando = ref(false)
const anulando = ref(false)
const anulada = ref(false)
const error = ref<ErrorParaMostrar | null>(null)

const id = computed(() => String(route.params.id ?? ''))
const idProductos = useId()

async function cargar(): Promise<void> {
  try {
    const todas = await aplicacion.inventario.historial()
    operacion.value = todas.find((o) => o.id === id.value) ?? null
    const anulaA = operacion.value?.anulaA
    original.value = anulaA ? (todas.find((o) => o.id === anulaA) ?? null) : null
    error.value = null
  } catch (causa) {
    error.value = errorParaMostrar(causa, 'anulacion')
  } finally {
    cargado.value = true
  }
}

watch(
  id,
  () => {
    anulada.value = false
    void cargar()
  },
  { immediate: true },
)

const cuando = computed(() => {
  const o = operacion.value
  if (!o) return ''
  return `${etiquetaDeDia(diaDe(o.ocurridaEn), hoyEnLaTienda())}, ${horaDe(o.ocurridaEn)}`
})
const puedeAnular = computed(
  () =>
    operacion.value !== null && operacion.value.tipo !== 'ANULACION' && !operacion.value.anulada,
)
const totales = computed(() => (operacion.value ? totalesDe(operacion.value) : []))
const pregunta = computed(() =>
  operacion.value ? `¿Anular ${nombreConArticulo(operacion.value)}?` : '',
)

async function anular(): Promise<void> {
  const actual = operacion.value
  confirmando.value = false
  if (!actual || anulando.value) return
  anulando.value = true
  error.value = null
  try {
    await aplicacion.inventario.anularOperacion({ operacionId: actual.id })
    anulada.value = true
    await enfocarTitulo()
  } catch (causa) {
    error.value = errorParaMostrar(causa, 'anulacion')
  } finally {
    anulando.value = false
  }
}
</script>

<template>
  <div class="vista-operacion">
    <PantallaExito
      v-if="anulada"
      titulo="Operación anulada"
      detalle="El stock volvió a como estaba."
    >
      <BotonPrincipal
        class="accion-exito"
        texto="Volver al Historial"
        :icono="History"
        @click="router.push({ name: 'historial' })"
      />
    </PantallaExito>

    <template v-else-if="operacion">
      <EncabezadoPagina :titulo="operacion.etiqueta" volver />
      <div class="detalle">
        <p class="cuando">{{ cuando }}</p>
        <AvisoEnPagina
          v-if="operacion.anulada"
          tono="info"
          titulo="Esta operación está anulada"
          texto="No cuenta en las ventas, las ganancias ni el stock."
        />
        <AvisoEnPagina
          v-if="operacion.tipo === 'ANULACION'"
          tono="info"
          titulo="Esta anulación deshizo otra operación"
          :texto="
            original
              ? `${original.etiqueta} del ${etiquetaDeDia(diaDe(original.ocurridaEn), hoyEnLaTienda()).toLowerCase()}, ${horaDe(original.ocurridaEn)}.`
              : undefined
          "
          :texto-accion="original ? 'Ver la operación anulada' : undefined"
          @accion="original && router.push({ name: 'operacion', params: { id: original.id } })"
        />

        <section class="seccion" :aria-labelledby="idProductos">
          <h2 :id="idProductos" class="subtitulo">Productos</h2>
          <FilaDeDato
            v-for="linea in operacion.lineas"
            :key="linea.productoId"
            :etiqueta="linea.nombre"
            :texto-valor="cuentaDeLinea(operacion, linea)"
          />
          <FilaDeDato
            v-for="total in totales"
            :key="total.etiqueta"
            :etiqueta="total.etiqueta"
            :texto-valor="total.valor"
            destacado
          />
          <FilaDeDato v-if="operacion.nota" etiqueta="Nota" :texto-valor="operacion.nota" />
        </section>

        <MensajeDeError v-if="error" :mensaje="error.mensaje" :ayuda="error.ayuda" />
        <BotonPrincipal
          v-if="puedeAnular"
          texto="Anular"
          variante="peligro"
          :icono="Ban"
          :deshabilitado="anulando"
          @click="confirmando = true"
        />
      </div>

      <DialogoConfirmacion
        :abierto="confirmando"
        :titulo="pregunta"
        mensaje="El stock vuelve a como estaba antes de esta operación. Una anulación no se puede deshacer."
        texto-confirmar="Sí, anular"
        texto-cancelar="No"
        peligro
        @confirmar="anular"
        @cancelar="confirmando = false"
      />
    </template>

    <template v-else-if="cargado">
      <EncabezadoPagina titulo="Operación" volver />
      <MensajeDeError v-if="error" :mensaje="error.mensaje" :ayuda="error.ayuda" />
      <EstadoVacio
        v-else
        titulo="No encontramos esa operación"
        descripcion="Búscala en el Historial."
        accion="Ir al Historial"
        @accion="router.push({ name: 'historial' })"
      />
    </template>
  </div>
</template>

<style scoped>
.detalle {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-5);
  max-inline-size: 40rem;
}
.cuando {
  margin: 0;
  color: var(--color-texto-suave);
  font-weight: 700;
}
.seccion {
  min-inline-size: 0;
}
.subtitulo {
  margin: 0 0 var(--espacio-2);
  font-size: 1.125rem;
}
.accion-exito {
  margin-top: var(--espacio-4);
  max-inline-size: 28rem;
}
</style>
