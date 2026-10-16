<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Check, Package } from 'lucide-vue-next'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { formatearCantidad, SIMBOLO_DE_UNIDAD } from '@/shared/domain/formato'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import CampoNumero from '@/shared/ui/componentes/CampoNumero.vue'
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
 * Contar stock (HU-OP-05, RN-OP-16): "¿Cuántos hay?" de un producto. Si coincide no se registra
 * nada ("El stock ya estaba correcto"); si no, un AJUSTE por la diferencia, con Deshacer. El
 * conteo es "a ciegas": no se muestra lo que la app tiene anotado, para no condicionar lo que se
 * cuenta en el estante.
 */
const aplicacion = useAplicacion()
const router = useRouter()
const destino = usarDestinos()
const deshacer = usarDeshacer()
const { producto, cargado, foto, usable, recargar, error: errorDeCarga } = usarProductoDeLaRuta()

const contado = ref('')
const errorCantidad = ref<string>()
const errorGeneral = ref<ErrorParaMostrar | null>(null)
const registrando = ref(false)
const exito = ref<{ titulo: string; detalle: string } | null>(null)
const deshecho = ref(false)

const porUnidades = computed(() => producto.value?.unidad === 'UNIDAD')
const etiqueta = computed(() =>
  producto.value ? `¿Cuántos hay? (${SIMBOLO_DE_UNIDAD[producto.value.unidad]})` : '¿Cuántos hay?',
)

async function guardar(): Promise<void> {
  const actual = producto.value
  if (!actual || registrando.value) return
  registrando.value = true
  errorCantidad.value = undefined
  errorGeneral.value = null
  try {
    const respuesta = await aplicacion.inventario.contarStock({
      productoId: actual.id,
      contado: contado.value,
    })
    if (respuesta.tipo === 'sin-cambios') {
      exito.value = {
        titulo: respuesta.mensaje,
        detalle: `${actual.nombre}: ${formatearCantidad(actual.stock, actual.unidad)}`,
      }
    } else {
      const diferencia = respuesta.diferencia
      const cuanto = `${formatearCantidad(diferencia.abs(), actual.unidad)} ${diferencia.esNegativa() ? 'menos' : 'más'}`
      const ahora = formatearCantidad(actual.stock.sumar(diferencia), actual.unidad)
      exito.value = {
        titulo: 'Stock corregido',
        detalle: `${actual.nombre}: ahora hay ${ahora} (${cuanto})`,
      }
      vibrar()
      deshacer.ofrecer({
        mensaje: 'Stock corregido',
        deshecho: 'Deshiciste el conteo',
        alDeshacer: () => {
          void recargar()
          if (exito.value === null) return
          exito.value = null
          deshecho.value = true
          void enfocarTitulo()
        },
      })
    }
    void recargar()
  } catch (causa) {
    const error = errorParaMostrar(causa, 'conteo')
    if (error.codigo?.startsWith('CANTIDAD') || error.codigo === 'CONTADO_NEGATIVO') {
      errorCantidad.value = error.mensaje
    } else {
      errorGeneral.value = error
    }
  } finally {
    registrando.value = false
  }
}

function volverAlProducto(): void {
  void router.push(destino('producto', { id: producto.value?.id ?? '' }))
}
</script>

<template>
  <div class="vista-contar-stock">
    <PantallaExito v-if="exito" :titulo="exito.titulo" :detalle="exito.detalle">
      <BotonPrincipal
        class="accion-exito"
        texto="Volver al producto"
        :icono="Package"
        @click="volverAlProducto"
      />
    </PantallaExito>

    <template v-else>
      <EncabezadoPagina titulo="Contar stock" volver />
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
          v-if="deshecho"
          tono="info"
          titulo="Deshiciste el conteo"
          texto="El stock volvió a como estaba."
          texto-cerrar="Cerrar"
          @cerrar="deshecho = false"
        />
        <ResumenDelProducto :producto="producto" :foto="foto" tamano="grande" />
        <CampoNumero
          v-model="contado"
          class="cantidad"
          :etiqueta="etiqueta"
          :decimales="!porUnidades"
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
        <BotonPrincipal
          texto="Guardar conteo"
          tipo="submit"
          :icono="Check"
          :deshabilitado="registrando"
        />
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
  margin-inline: auto;
}
.cantidad {
  justify-self: center;
  inline-size: 100%;
  max-inline-size: 22rem;
}
.accion-exito {
  margin-top: var(--espacio-4);
  max-inline-size: 28rem;
}
</style>
