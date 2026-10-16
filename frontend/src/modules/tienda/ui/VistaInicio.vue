<script setup lang="ts">
import { computed, onMounted, ref, useId, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ChevronRight, CircleHelp, History, PackagePlus, Settings, ShoppingCart, X } from 'lucide-vue-next'
import { useEstadoGlobal } from '@/app/estado-global'
import { useAplicacion } from '@/app/proveer-aplicacion'
import type { ResumenDeAtencion } from '@/modules/alertas'
import type { Dinero } from '@/shared/domain/dinero'
import { formatearDinero, plural } from '@/shared/domain/formato'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import Boton from '@/shared/ui/componentes/Boton.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import EstadoVacio from '@/shared/ui/componentes/EstadoVacio.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import TarjetaDeCifra from '@/shared/ui/componentes/TarjetaDeCifra.vue'
import { usarInstalacion } from './instalacion'
import { haciaPantalla, type PantallaDeOtraRama } from './pantallas-de-otras-ramas'

const aplicacion = useAplicacion()
const estadoGlobal = useEstadoGlobal()
const router = useRouter()
const instalacion = usarInstalacion()
const idResumen = useId()

const nombreTienda = ref('')
const deHoy = ref<{ ganancia: Dinero; ventas: Dinero } | null>(null)
const atencion = ref<ResumenDeAtencion | null>(null)
const hayProductos = ref(true)
const fallo = ref(false)

/** RN-AN-03: la ganancia neta de hoy (o la pérdida, dicha como tal) y las ventas. */
const cifraDeHoy = computed(() => {
  if (!deHoy.value) return null
  const { ganancia, ventas } = deHoy.value
  const perdio = ganancia.esNegativo()
  return {
    titulo: perdio ? 'Hoy perdiste' : 'Hoy ganaste',
    valor: formatearDinero(perdio ? ganancia.negar() : ganancia),
    detalle: ventas.esCero() ? 'Todavía no hay ventas hoy' : `Vendiste ${formatearDinero(ventas)}`,
    tono: perdio ? ('peligro' as const) : ('normal' as const),
  }
})

/** RN-AL-06a: "4 productos se acaban" (agotados + por acabarse). */
const tituloDeAtencion = computed(() => {
  const n = atencion.value?.contador ?? 0
  return `${n} ${plural(n, 'producto se acaba', 'productos se acaban')}`
})

async function cargarAtencion(): Promise<void> {
  atencion.value = await aplicacion.alertas.resumenDeAtencion()
}

async function cargar(): Promise<void> {
  try {
    const [configuracion, resumen, productos] = await Promise.all([
      aplicacion.tienda.obtenerConfiguracion(),
      aplicacion.analisis.consultarResumen('HOY'),
      aplicacion.catalogo.consultable.productos({ soloActivos: true }),
      cargarAtencion(),
    ])
    nombreTienda.value = configuracion.nombreTienda
    deHoy.value = { ganancia: resumen.gananciaNeta, ventas: resumen.ventas }
    hayProductos.value = productos.length > 0
  } catch (error) {
    console.error('No se pudo preparar Inicio:', error)
    fallo.value = true
  }
}

onMounted(() => {
  void cargar()
  void estadoGlobal.refrescarRecordatorioDeCopia()
})

// El contador del botón Control cambia con los eventos: el aviso de Inicio lo sigue.
watch(
  () => estadoGlobal.contadorDeAtencion,
  () => {
    void cargarAtencion().catch((error: unknown) => {
      console.error('No se pudo actualizar el aviso de Inicio:', error)
    })
  },
)

function ir(nombre: PantallaDeOtraRama): void {
  void router.push(haciaPantalla(router, nombre))
}
</script>

<template>
  <div class="vista-inicio">
    <header class="saludo">
      <h1>
        Hola<template v-if="nombreTienda">, {{ nombreTienda }}</template>
        <span aria-hidden="true">👋</span>
      </h1>
      <RouterLink :to="{ name: 'ajustes' }" class="enlace-ajustes">
        <Settings aria-hidden="true" class="icono" />
        <span>Ajustes</span>
      </RouterLink>
    </header>

    <MensajeDeError
      v-if="fallo"
      mensaje="No pudimos leer tus datos de hoy"
      ayuda="Cierra la app y vuelve a abrirla. Tus datos siguen guardados."
    />

    <div class="cuerpo">
      <div class="informacion">
        <!-- RN-AL-09: una vez al día; se cierra con un toque. -->
        <section
          v-if="estadoGlobal.resumenDelDia"
          class="resumen-del-dia"
          data-resumen-del-dia
          :aria-labelledby="idResumen"
        >
          <h2 :id="idResumen">Resumen del día</h2>
          <ul>
            <li v-for="linea in estadoGlobal.resumenDelDia.lineas" :key="linea">{{ linea }}</li>
          </ul>
          <Boton texto="Cerrar" :icono="X" @click="estadoGlobal.cerrarResumenDelDia()" />
        </section>

        <TarjetaDeCifra
          v-if="cifraDeHoy"
          :titulo="cifraDeHoy.titulo"
          :texto-valor="cifraDeHoy.valor"
          :texto-detalle="cifraDeHoy.detalle"
          :tono="cifraDeHoy.tono"
        />

        <template v-if="atencion">
          <EstadoVacio
            v-if="!hayProductos"
            titulo="Aún no tienes productos"
            descripcion="Agrégalos para llevar tu stock y saber qué comprar."
            accion="Agregar el primero"
            @accion="ir('producto-nuevo')"
          />
          <AvisoEnPagina
            v-else-if="atencion.contador > 0"
            tono="atencion"
            :titulo="tituloDeAtencion"
            :texto="atencion.texto"
            texto-accion="Ver qué comprar"
            @accion="ir('para-comprar')"
          />
          <AvisoEnPagina v-else tono="exito" :titulo="atencion.texto" />
        </template>
      </div>

      <div class="acciones">
        <BotonPrincipal texto="Vender" :icono="ShoppingCart" @click="ir('vender')" />
        <BotonPrincipal
          texto="Llegó mercadería"
          variante="secundario"
          :icono="PackagePlus"
          @click="ir('recibir')"
        />
        <BotonPrincipal
          texto="¿Necesito comprar?"
          variante="secundario"
          :icono="CircleHelp"
          @click="ir('necesito-comprar')"
        />
        <RouterLink :to="haciaPantalla(router, 'historial')" class="enlace-historial">
          <History aria-hidden="true" class="icono" />
          <span>Historial</span>
          <ChevronRight aria-hidden="true" class="icono" />
        </RouterLink>
      </div>

      <div
        v-if="estadoGlobal.recordatorioDeCopia || instalacion.mostrar.value"
        class="extras"
      >
        <!-- RN-RE-06 -->
        <AvisoEnPagina
          v-if="estadoGlobal.recordatorioDeCopia"
          tono="info"
          :titulo="estadoGlobal.recordatorioDeCopia"
          texto="Si pierdes el celular, con una copia recuperas todo."
          texto-accion="Guardar copia ahora"
          @accion="router.push({ name: 'guardar-copia' })"
        />
        <!-- RN-UX-13: con el botón del navegador o, si no lo ofrece, con los pasos. -->
        <template v-if="instalacion.mostrar.value">
          <AvisoEnPagina
            v-if="instalacion.sePuedeInstalar.value"
            tono="info"
            titulo="Instala la app en tu celular"
            texto="Así la abres con un toque, como cualquier app, y funciona sin internet."
            texto-accion="Instalar"
            texto-cerrar="Ahora no"
            @accion="instalacion.instalar()"
            @cerrar="instalacion.cerrar()"
          />
          <AvisoEnPagina
            v-else
            tono="info"
            titulo="Instala la app en tu celular"
            texto="En Chrome, toca el menú ⋮ (arriba a la derecha) y elige «Agregar a la pantalla principal» o «Instalar app»."
            texto-cerrar="Ahora no"
            @cerrar="instalacion.cerrar()"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vista-inicio {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
}
.saludo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--espacio-2) var(--espacio-4);
  padding-block: var(--espacio-2);
}
h1 {
  margin: 0;
  font-size: 1.5rem;
  line-height: 1.2;
}
.enlace-ajustes,
.enlace-historial {
  display: inline-flex;
  align-items: center;
  gap: var(--espacio-2);
  min-height: var(--alto-toque);
  padding-inline: var(--espacio-3);
  border-radius: var(--radio-chico);
  color: var(--color-primario);
  font-weight: 700;
  text-decoration: none;
}
.enlace-ajustes {
  border: 2px solid var(--color-borde);
  background: var(--color-fondo);
}
.enlace-historial {
  align-self: flex-start;
  padding-inline: var(--espacio-2);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
.icono {
  width: 1.25em;
  height: 1.25em;
  flex: none;
}

.cuerpo {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-5);
}
.informacion,
.extras {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
}
.acciones {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
}

.resumen-del-dia {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--espacio-2);
  padding: var(--espacio-4);
  border-radius: var(--radio);
  border-left: 6px solid var(--color-primario);
  background: var(--color-primario-suave);
}
.resumen-del-dia h2 {
  margin: 0;
  font-size: 1.1rem;
}
.resumen-del-dia ul {
  margin: 0;
  padding-left: 1.25em;
}
.resumen-del-dia li + li {
  margin-top: var(--espacio-1);
}

/* PC: lo que hay que saber a la izquierda y lo que hay que hacer a la derecha. */
@media (min-width: 1024px) {
  .cuerpo {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    grid-template-rows: auto 1fr;
    grid-template-areas:
      'informacion acciones'
      'extras acciones';
    align-items: start;
    column-gap: var(--espacio-6);
  }
  .informacion {
    grid-area: informacion;
  }
  .acciones {
    grid-area: acciones;
  }
  .extras {
    grid-area: extras;
  }
}
</style>
