<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Bell } from 'lucide-vue-next'
import { useAplicacion } from '@/app/proveer-aplicacion'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import PantallaExito from '@/shared/ui/componentes/PantallaExito.vue'

/**
 * RN-AL-08: el permiso de notificaciones se pide SOLO aquí, después de explicar para qué sirve.
 * M1: conceder el permiso no alcanza; la configuración de la tienda también tiene que decir que
 * están activas (`notificacionesPermitidas` exige las dos cosas), si no nunca llega ninguna.
 */
const aplicacion = useAplicacion()
const router = useRouter()

const estado = ref<'leyendo' | 'pregunta' | 'activados' | 'concedido' | 'rechazado'>('leyendo')
const pidiendo = ref(false)
const fallo = ref(false)

onMounted(async () => {
  try {
    estado.value = (await aplicacion.alertas.notificacionesPermitidas()) ? 'activados' : 'pregunta'
  } catch (error) {
    console.error('No se pudo saber si los avisos están activados:', error)
    estado.value = 'pregunta'
  }
})

async function siAvisame(): Promise<void> {
  pidiendo.value = true
  fallo.value = false
  try {
    const concedido = await aplicacion.alertas.solicitarPermiso()
    if (concedido) await aplicacion.tienda.actualizarConfiguracion({ notificacionesActivas: true })
    estado.value = concedido ? 'concedido' : 'rechazado'
  } catch (error) {
    console.error('No se pudieron activar los avisos:', error)
    fallo.value = true
  } finally {
    pidiendo.value = false
  }
}

function volver(): void {
  const hayAtras = Boolean((window.history.state as { back?: string | null } | null)?.back)
  if (hayAtras) router.back()
  else void router.replace({ name: 'ajustes' })
}
</script>

<template>
  <PantallaExito
    v-if="estado === 'concedido'"
    titulo="Listo, te avisaremos"
    detalle="Cuando un producto se esté acabando, te llegará un aviso al celular."
  >
    <BotonPrincipal texto="Volver" @click="volver" />
  </PantallaExito>

  <div v-else class="vista-avisos">
    <EncabezadoPagina titulo="Avisos en tu celular" volver @volver="volver" />

    <div class="explicacion">
      <span class="sello" aria-hidden="true"><Bell class="sello-icono" /></span>
      <p class="destacado">
        Te avisamos en tu celular cuando un producto se acaba o está por acabarse, para que compres
        a tiempo.
      </p>
      <p>Los avisos llegan mientras usas la app o justo después de usarla.</p>
      <p>Si prefieres no recibirlos, igual verás lo que se acaba en Inicio y en Control.</p>
    </div>

    <AvisoEnPagina
      v-if="estado === 'activados'"
      tono="exito"
      titulo="Ya tienes los avisos activados"
      texto="Si quieres apagarlos, hazlo desde Ajustes."
    />
    <MensajeDeError
      v-else-if="estado === 'rechazado'"
      mensaje="No se activaron los avisos"
      ayuda="Para activarlos, abre los ajustes del navegador, entra a Notificaciones y permite esta app. Mientras tanto, verás lo que se acaba en Inicio y en Control."
    />
    <MensajeDeError
      v-if="fallo"
      mensaje="No pudimos activar los avisos"
      ayuda="Vuelve a intentarlo en un momento."
    />

    <div v-if="estado === 'pregunta' || estado === 'rechazado'" class="acciones">
      <BotonPrincipal
        texto="Sí, avísame"
        :icono="Bell"
        :deshabilitado="pidiendo"
        @click="siAvisame"
      />
      <BotonPrincipal texto="Ahora no" variante="secundario" @click="volver" />
    </div>
    <div v-else-if="estado === 'activados'" class="acciones">
      <BotonPrincipal texto="Volver" variante="secundario" @click="volver" />
    </div>
  </div>
</template>

<style scoped>
.vista-avisos {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
  min-height: calc(100dvh - var(--alto-pie, 0px) - 2 * var(--relleno-bloque, var(--espacio-4)));
}
.explicacion {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
}
.explicacion p {
  margin: 0;
}
.destacado {
  font-size: 1.15rem;
  font-weight: 700;
}
.sello {
  display: grid;
  place-items: center;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 50%;
  background: var(--color-primario-suave);
  color: var(--color-primario);
}
.sello-icono {
  width: 2.5rem;
  height: 2.5rem;
}
.acciones {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
}
@media (min-width: 1024px) {
  .vista-avisos {
    min-height: auto;
    max-width: 40rem;
  }
  .acciones {
    margin-top: var(--espacio-4);
  }
}
</style>
