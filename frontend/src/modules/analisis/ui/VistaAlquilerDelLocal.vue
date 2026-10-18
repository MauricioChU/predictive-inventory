<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAplicacion } from '@/app/proveer-aplicacion'
import type { AlquilerDelLocal } from '@/shared/contratos/configuracion'
import {
  montoDelAlquilerDeTexto,
  validarAlquilerDelLocal,
} from '@/shared/domain/alquiler-del-local'
import { ErrorDeDominio, esErrorDeDominio } from '@/shared/domain/errores'
import BotonesDeOpcion from '@/shared/ui/componentes/BotonesDeOpcion.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import CampoNumero from '@/shared/ui/componentes/CampoNumero.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import PantallaExito from '@/shared/ui/componentes/PantallaExito.vue'
import SelectorDeDia from '@/shared/ui/componentes/SelectorDeDia.vue'
import { PREGUNTA_DEL_ALQUILER } from '../domain/alquiler'

/**
 * Alquiler del local (RN-AN-17; 06-experiencia-de-uso): tres botones de opción y, si paga, el
 * monto (con − / +) y uno o dos días del mes. Se abre desde la tarjeta de Control y desde
 * Ajustes → Datos de la tienda (`?desde=ajustes`, para volver a donde se estaba).
 */
type Tipo = 'MENSUAL' | 'QUINCENAL' | 'NO_PAGA'
type Campo = 'tipo' | 'monto' | 'dia1' | 'dia2'

const OPCIONES: readonly { valor: Tipo; etiqueta: string }[] = [
  { valor: 'MENSUAL', etiqueta: 'Una vez al mes' },
  { valor: 'QUINCENAL', etiqueta: 'Dos veces al mes' },
  { valor: 'NO_PAGA', etiqueta: 'No pago, el local es mío' },
]
/** De cuánto en cuánto sube y baja el monto con − / +. */
const PASO_DEL_MONTO = 10

const aplicacion = useAplicacion()
const router = useRouter()
const route = useRoute()

const tipo = ref<Tipo | null>(null)
const monto = ref('')
const dia1 = ref<number | null>(null)
const dia2 = ref<number | null>(null)
const errores = reactive<Partial<Record<Campo, string>>>({})
const leido = ref(false)
const guardando = ref(false)
const guardado = ref(false)
const fallo = ref<string | null>(null)

const paga = computed(() => tipo.value === 'MENSUAL' || tipo.value === 'QUINCENAL')
const desdeAjustes = computed(() => route.query.desde === 'ajustes')

onMounted(async () => {
  try {
    const actual = (await aplicacion.tienda.obtenerConfiguracion()).alquilerDelLocal
    if (actual) {
      tipo.value = actual.tipo
      if (actual.tipo !== 'NO_PAGA') {
        monto.value = (actual.montoCentimos / 100).toFixed(2)
        dia1.value = actual.dias[0]
        dia2.value = actual.tipo === 'QUINCENAL' ? actual.dias[1] : null
      }
    }
    leido.value = true
  } catch (causa) {
    console.error('No se pudo leer el alquiler del local:', causa)
    fallo.value = 'No pudimos leer el alquiler de tu local'
  }
})

/** Un mensaje sobre el monto va junto al monto; los demás (los días), junto al día. */
function campoDelMensaje(mensaje: string): Campo {
  return /monto/i.test(mensaje) ? 'monto' : 'dia1'
}

function hayErrores(): boolean {
  return Boolean(errores.tipo || errores.monto || errores.dia1 || errores.dia2)
}

function limpiarErrores(): void {
  errores.tipo = errores.monto = errores.dia1 = errores.dia2 = undefined
}

/** Lo escrito en pantalla como `AlquilerDelLocal`; lanza si falta algo o está mal. */
function construir(): AlquilerDelLocal {
  if (tipo.value === null) {
    errores.tipo = 'Elige cada cuánto pagas el alquiler'
    throw new ErrorDeDominio('ALQUILER_SIN_TIPO', errores.tipo)
  }
  if (tipo.value === 'NO_PAGA') return { tipo: 'NO_PAGA' }

  const quincenal = tipo.value === 'QUINCENAL'
  if (monto.value.trim() === '') errores.monto = 'Escribe cuánto pagas cada vez'
  if (dia1.value === null) {
    errores.dia1 = quincenal ? 'Elige el primer día de pago' : 'Elige el día de pago'
  }
  if (quincenal && dia2.value === null) errores.dia2 = 'Elige el segundo día de pago'
  if (hayErrores()) throw new ErrorDeDominio('ALQUILER_INCOMPLETO', 'Faltan datos')

  const montoCentimos = montoDelAlquilerDeTexto(monto.value).centimos
  const alquiler: AlquilerDelLocal = quincenal
    ? { tipo: 'QUINCENAL', montoCentimos, dias: [dia1.value!, dia2.value!] }
    : { tipo: 'MENSUAL', montoCentimos, dias: [dia1.value!] }
  const invalido = validarAlquilerDelLocal(alquiler)
  if (invalido !== null) throw new ErrorDeDominio('ALQUILER_INVALIDO', invalido)
  return alquiler
}

async function guardar(): Promise<void> {
  fallo.value = null
  limpiarErrores()
  try {
    const alquilerDelLocal = construir()
    guardando.value = true
    await aplicacion.tienda.actualizarConfiguracion({ alquilerDelLocal })
    guardado.value = true
  } catch (causa) {
    if (!esErrorDeDominio(causa)) {
      console.error('No se pudo guardar el alquiler del local:', causa)
      fallo.value = 'No se pudo guardar el alquiler del local'
    } else if (!hayErrores()) {
      errores[campoDelMensaje(causa.message)] = causa.message
    }
  } finally {
    guardando.value = false
  }
}

/** De dos veces al mes a una se conserva el primer día; de una a dos, el segundo se elige de nuevo. */
function alCambiarElTipo(nuevo: Tipo): void {
  tipo.value = nuevo
  if (nuevo !== 'QUINCENAL') dia2.value = null
  limpiarErrores()
}

function volver(): void {
  void router.push({ name: desdeAjustes.value ? 'datos-de-la-tienda' : 'control' })
}
</script>

<template>
  <PantallaExito v-if="guardado" titulo="Listo, guardamos el alquiler del local">
    <BotonPrincipal texto="Volver" @click="volver" />
  </PantallaExito>

  <div v-else class="vista-alquiler-del-local">
    <EncabezadoPagina titulo="Alquiler del local" volver />

    <MensajeDeError
      v-if="!leido && fallo"
      :mensaje="fallo"
      ayuda="Vuelve a Control y entra de nuevo en un momento."
    />

    <form v-if="leido" class="formulario" novalidate @submit.prevent="guardar">
      <BotonesDeOpcion
        :model-value="tipo"
        :opciones="OPCIONES"
        :etiqueta="PREGUNTA_DEL_ALQUILER"
        :error="errores.tipo"
        @update:model-value="alCambiarElTipo"
      />

      <template v-if="paga">
        <CampoNumero
          v-model="monto"
          etiqueta="¿Cuánto pagas cada vez? (S/)"
          :paso="PASO_DEL_MONTO"
          :minimo="0"
          decimales
          :error="errores.monto"
        />
        <SelectorDeDia
          v-model="dia1"
          :etiqueta="tipo === 'QUINCENAL' ? 'Primer día de pago' : '¿Qué día pagas?'"
          :error="errores.dia1"
        />
        <SelectorDeDia
          v-if="tipo === 'QUINCENAL'"
          v-model="dia2"
          etiqueta="Segundo día de pago"
          :error="errores.dia2"
        />
      </template>

      <MensajeDeError v-if="fallo" :mensaje="fallo" ayuda="Revisa los datos y vuelve a guardar." />

      <div class="acciones">
        <BotonPrincipal texto="Guardar" tipo="submit" :deshabilitado="guardando" />
      </div>
    </form>
  </div>
</template>

<style scoped>
.vista-alquiler-del-local {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
}
.formulario {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-5);
}
.acciones {
  display: flex;
  flex-direction: column;
}
@media (min-width: 1024px) {
  .vista-alquiler-del-local {
    max-width: 40rem;
  }
}
</style>
