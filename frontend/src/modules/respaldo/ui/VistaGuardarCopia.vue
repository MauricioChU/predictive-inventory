<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Download, Save } from 'lucide-vue-next'
import { useEstadoGlobal } from '@/app/estado-global'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { diaDe } from '@/shared/domain/fecha'
import { esErrorDeDominio } from '@/shared/domain/errores'
import { formatearDia } from '@/shared/domain/formato'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import FilaDeDato from '@/shared/ui/componentes/FilaDeDato.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import PantallaExito from '@/shared/ui/componentes/PantallaExito.vue'
import { entregarArchivo, sePuedeCompartir, type Entrega } from '@/shared/ui/entregar-archivo'

/**
 * RN-RE-02: la copia completa sale del celular (compartida o descargada) y RECIÉN ENTONCES cuenta
 * como guardada (`marcarCopiaGuardada`, RN-RE-06): si la persona cierra el menú de compartir sin
 * elegir nada, el recordatorio sigue.
 */
const aplicacion = useAplicacion()
const estadoGlobal = useEstadoGlobal()
const router = useRouter()

const conMenuDeCompartir = sePuedeCompartir({ nombre: 'respaldo.json', tipo: 'application/json' })
const ultimaCopia = ref<string | null>(null)
const trabajando = ref(false)
const resultado = ref<{ entrega: Entrega; nombre: string } | null>(null)
const error = ref<string | null>(null)

const textoUltimaCopia = computed(() =>
  ultimaCopia.value === null
    ? 'Todavía no guardas una copia de tus datos'
    : formatearDia(diaDe(ultimaCopia.value)),
)

onMounted(async () => {
  try {
    ultimaCopia.value = (await aplicacion.tienda.consultable.estadoDelSistema()).ultimoRespaldoEn
  } catch (causa) {
    console.error('No se pudo leer la fecha de la última copia:', causa)
  }
})

async function guardar(modo: 'compartir' | 'descargar'): Promise<void> {
  trabajando.value = true
  error.value = null
  resultado.value = null
  try {
    const archivo = await aplicacion.respaldo.guardarCopia()
    const entrega = await entregarArchivo(archivo, modo)
    if (entrega !== 'cancelado') {
      await aplicacion.respaldo.marcarCopiaGuardada()
      await estadoGlobal.refrescarRecordatorioDeCopia()
    }
    resultado.value = { entrega, nombre: archivo.nombre }
  } catch (causa) {
    if (!esErrorDeDominio(causa)) console.error('No se pudo guardar la copia:', causa)
    error.value = esErrorDeDominio(causa) ? causa.message : 'No se pudo guardar la copia'
  } finally {
    trabajando.value = false
  }
}
</script>

<template>
  <PantallaExito
    v-if="resultado && resultado.entrega !== 'cancelado'"
    titulo="Copia guardada"
    :detalle="
      resultado.entrega === 'compartido'
        ? `Mandaste ${resultado.nombre}. Si pierdes el celular, con esa copia recuperas todo.`
        : `Quedó en Descargas: ${resultado.nombre}. Mándala por WhatsApp o guárdala en Drive para que esté fuera de este celular.`
    "
  >
    <BotonPrincipal texto="Volver al inicio" @click="router.push({ name: 'inicio' })" />
  </PantallaExito>

  <div v-else class="vista-guardar-copia">
    <EncabezadoPagina titulo="Guardar copia" volver />

    <div class="explicacion">
      <p class="destacado">
        Una copia tiene todos los datos de tu tienda: productos, fotos, ventas y llegadas de
        mercadería.
      </p>
      <p>
        Mándala por WhatsApp a alguien de confianza o guárdala en Drive. Si pierdes el celular o se
        malogra, con esa copia recuperas todo en otro.
      </p>
      <FilaDeDato etiqueta="Tu última copia" :texto-valor="textoUltimaCopia" />
    </div>

    <AvisoEnPagina
      v-if="resultado?.entrega === 'cancelado'"
      tono="info"
      titulo="No se guardó la copia"
      texto="Cerraste el menú sin elegir dónde mandarla. Vuelve a intentarlo cuando quieras."
    />
    <MensajeDeError v-if="error" :mensaje="error" ayuda="Vuelve a intentarlo en un momento." />

    <div class="acciones">
      <p v-if="!conMenuDeCompartir" class="nota">La copia se guarda en tu carpeta de Descargas.</p>
      <BotonPrincipal
        texto="Guardar copia ahora"
        :icono="Save"
        :deshabilitado="trabajando"
        @click="guardar('compartir')"
      />
      <BotonPrincipal
        v-if="conMenuDeCompartir"
        texto="Descargar en este celular"
        variante="secundario"
        :icono="Download"
        :deshabilitado="trabajando"
        @click="guardar('descargar')"
      />
    </div>
  </div>
</template>

<style scoped>
.vista-guardar-copia {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
  min-height: calc(100dvh - var(--alto-pie, 0px) - 2 * var(--espacio-4));
}
.explicacion {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
}
.explicacion p,
.nota {
  margin: 0;
}
.destacado {
  font-size: 1.15rem;
  font-weight: 700;
}
.nota {
  color: var(--color-texto-suave);
}
.acciones {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
}
@media (min-width: 1024px) {
  .vista-guardar-copia {
    min-height: auto;
    max-width: 40rem;
  }
  .acciones {
    margin-top: var(--espacio-4);
  }
}
</style>
