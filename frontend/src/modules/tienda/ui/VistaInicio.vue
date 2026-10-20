<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  ChevronRight,
  CircleHelp,
  History,
  PackagePlus,
  Settings,
  ShoppingCart,
} from 'lucide-vue-next'
import { useEstadoGlobal } from '@/app/estado-global'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { RUTA_SE_ACABAN, type ResumenDeAtencion } from '@/modules/alertas'
import type { Dinero } from '@/shared/domain/dinero'
import { formatearDinero, plural } from '@/shared/domain/formato'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import EstadoVacio from '@/shared/ui/componentes/EstadoVacio.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import TarjetaDeCifra from '@/shared/ui/componentes/TarjetaDeCifra.vue'
import FechaDeHoy from './FechaDeHoy.vue'
import { haciaPantalla, type PantallaDeOtraRama } from './pantallas-de-otras-ramas'

const aplicacion = useAplicacion()
const estadoGlobal = useEstadoGlobal()
const router = useRouter()

const nombreTienda = ref('')
const deHoy = ref<{ ganancia: Dinero; ventas: Dinero } | null>(null)
const atencion = ref<ResumenDeAtencion | null>(null)
/** `null` mientras se lee. */
const hayProductos = ref<boolean | null>(null)
const fallo = ref(false)

/** Plan 20: el nombre de la tienda en mayúsculas (el guardado no cambia); sin nombre, solo "Inicio". */
const encabezado = computed(() => nombreTienda.value.trim().toLocaleUpperCase('es') || 'Inicio')

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

/** RN-AL-06a: el aviso abre Productos ya filtrado por "Se acaban" (RN-CAT-16). */
function verLoQueSeAcaba(): void {
  void router.push(RUTA_SE_ACABAN)
}
</script>

<template>
  <div class="vista-inicio">
    <header class="saludo">
      <h1>{{ encabezado }}</h1>
      <!-- Excepción deliberada a RN-UX-04: solo la tuerca, con nombre accesible y zona de 48 px. -->
      <RouterLink :to="{ name: 'ajustes' }" class="enlace-ajustes" aria-label="Ajustes">
        <Settings aria-hidden="true" class="icono" />
      </RouterLink>
    </header>

    <FechaDeHoy />

    <MensajeDeError
      v-if="fallo"
      mensaje="No pudimos leer tus datos de hoy"
      ayuda="Cierra la app y vuelve a abrirla. Tus datos siguen guardados."
    />

    <!--
      Inicio es para vender (plan 19). Celular: encabezado → fecha → lo de hoy (cifras y lo
      que se acaba) → espacio libre → las acciones, pegadas abajo, al alcance del pulgar (si el
      contenido es más alto que la pantalla, todo fluye sin taparse). PC: lo que hay que saber a
      la izquierda y lo que hay que hacer a la derecha.
    -->
    <div class="cuerpo">
      <TarjetaDeCifra
        v-if="cifraDeHoy"
        class="cifra"
        :titulo="cifraDeHoy.titulo"
        :texto-valor="cifraDeHoy.valor"
        :texto-detalle="cifraDeHoy.detalle"
        :tono="cifraDeHoy.tono"
      />

      <div v-if="atencion" class="atencion">
        <EstadoVacio
          v-if="hayProductos === false"
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
          texto-accion="Ver productos"
          @accion="verLoQueSeAcaba"
        />
        <AvisoEnPagina v-else tono="exito" :titulo="atencion.texto" />
      </div>

      <div class="acciones">
        <div class="vender-fijo">
          <BotonPrincipal texto="Vender" :icono="ShoppingCart" @click="ir('vender')" />
        </div>
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
    </div>
  </div>
</template>

<style scoped>
.vista-inicio {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
  /* Ocupa el alto que deja libre la navegación (medida en vivo en --alto-pie). */
  min-height: calc(100dvh - var(--alto-pie, 0px) - 2 * var(--espacio-4));
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
  justify-content: center;
  min-width: var(--alto-toque);
  padding-inline: var(--espacio-2);
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
  flex: 1;
  flex-direction: column;
  gap: var(--espacio-4);
}
/* Celular: sin caja propia, así "Vender" se pega abajo dentro de todo el cuerpo de Inicio (un
   elemento pegajoso no sale de la caja de su padre). */
.acciones {
  display: contents;
}
/* Celular: "Vender" queda pegado sobre la navegación (--alto-pie, medido en vivo) mientras su
   lugar está más abajo; al llegar a él, sigue en su sitio. El primero de las acciones lleva
   `margin-top: auto`: todo el bloque queda al fondo del área de contenido. */
.vender-fijo {
  position: sticky;
  bottom: var(--alto-pie, 0px);
  z-index: 5;
  /* De borde a borde del contenido (cubre el relleno de <main>): el navegador dibuja la franja
     pegada aparte y sus bordes laterales dejaban una línea fina junto al botón; así quedan en el
     borde de la pantalla. */
  margin: auto calc(-1 * var(--espacio-4)) calc(-1 * var(--espacio-2));
  padding: var(--espacio-2) var(--espacio-4);
  background: var(--color-fondo);
}
/* Lo enfocado con el teclado no queda debajo de "Vender" pegado (WCAG 2.4.11)... */
.vista-inicio :is(a, button) {
  scroll-margin-bottom: calc(var(--alto-boton-principal) + 2 * var(--espacio-2));
}
/* ...salvo el propio "Vender": ya está a la vista, enfocarlo no mueve la página. */
.vender-fijo button {
  scroll-margin-bottom: 0;
}

/* PC, en el mismo orden que el código (WCAG 1.3.2 / 2.4.3): las cifras y el aviso a la izquierda
   y las acciones a la derecha. Sin filas vacías: la separación es el margen de cada bloque, no
   el espacio entre filas. */
@media (min-width: 1024px) {
  .vista-inicio {
    min-height: auto;
  }
  .cuerpo {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    grid-template-rows: auto 1fr;
    grid-template-areas:
      'cifra acciones'
      'atencion acciones';
    align-items: start;
    gap: 0 var(--espacio-6);
  }
  .cifra {
    grid-area: cifra;
  }
  .atencion {
    grid-area: atencion;
  }
  .acciones {
    grid-area: acciones;
    display: flex;
    flex-direction: column;
    gap: var(--espacio-3);
  }
  .cifra,
  .atencion,
  .acciones {
    margin-bottom: var(--espacio-4);
  }
  .vender-fijo {
    position: static;
    margin: 0;
    padding: 0;
    background: none;
  }
  .vista-inicio :is(a, button) {
    scroll-margin-bottom: 0;
  }
}
</style>
