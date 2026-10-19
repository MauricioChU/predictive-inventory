<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  CalendarCheck,
  CalendarRange,
  ChevronRight,
  CircleHelp,
  CircleX,
  Hourglass,
  KeyRound,
  ShoppingBasket,
  Tag,
  TriangleAlert,
  Trophy,
  Wallet,
} from 'lucide-vue-next'
import { useAplicacion } from '@/app/proveer-aplicacion'
import {
  formatearCantidad,
  formatearDinero,
  formatearEntero,
  plural,
} from '@/shared/domain/formato'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import Boton from '@/shared/ui/componentes/Boton.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import FilaDeDato from '@/shared/ui/componentes/FilaDeDato.vue'
import GraficoBarras from '@/shared/ui/componentes/GraficoBarras.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import SelectorSegmentado from '@/shared/ui/componentes/SelectorSegmentado.vue'
import TarjetaDeCifra from '@/shared/ui/componentes/TarjetaDeCifra.vue'
import BarraDeProgreso from '@/shared/ui/componentes/BarraDeProgreso.vue'
import { pegarCifras } from '@/shared/ui/texto-sin-cortes'
import type { TorreDeControl } from '../application/torre'
import { BOTON_CONFIGURAR_ALQUILER, PREGUNTA_DEL_ALQUILER } from '../domain/alquiler'
import { SUGERENCIA_PARA_PARADOS } from '../domain/observaciones'
import type { Periodo } from '../domain/periodos'
import EnlaceAProducto from './componentes/EnlaceAProducto.vue'
import FilaDeAtencion from './componentes/FilaDeAtencion.vue'
import SeccionDeControl from './componentes/SeccionDeControl.vue'
import {
  OPCIONES_DE_MAS_VENDIDOS,
  OPCIONES_DE_PERIODO,
  partesDelCambio,
  textoDeDia,
  textoMejorDia,
  textoPerdidaPorUnidad,
  textoSinVender,
  textoSinVentas,
  textoVeces,
  tituloDeGanancia,
  type PeriodoDeMasVendidos,
} from './textos'

/** Cuántas líneas de la lista para comprar se adelantan en la tarjeta (el resto, "y N más"). */
const LINEAS_EN_EL_RESUMEN = 3

const aplicacion = useAplicacion()
const router = useRouter()

const periodo = ref<Periodo>('HOY')
const periodoMasVendidos = ref<PeriodoDeMasVendidos>(7)

/** Lo que se ve: la torre con los periodos con los que se calculó (no los recién elegidos). */
interface Mostrado {
  torre: TorreDeControl
  periodo: Periodo
  periodoMasVendidos: PeriodoDeMasVendidos
}
const mostrado = shallowRef<Mostrado | null>(null)
const actualizando = ref(false)
const fallo = ref(false)

let ultimoPedido = 0

/** RN-AN-15: todo se calcula en el celular, con una sola lectura (RN-SIS-09). Si se cambia de
 * periodo dos veces seguidas, solo cuenta la última respuesta. */
async function cargar(): Promise<void> {
  const pedido = ++ultimoPedido
  const opciones = { periodo: periodo.value, periodoMasVendidos: periodoMasVendidos.value }
  actualizando.value = true
  try {
    const torre = await aplicacion.analisis.consultarTorre(opciones)
    if (pedido !== ultimoPedido) return
    mostrado.value = { torre, ...opciones }
    fallo.value = false
  } catch (error) {
    if (pedido !== ultimoPedido) return
    console.error('No se pudo calcular la Torre de control:', error)
    fallo.value = true
  } finally {
    if (pedido === ultimoPedido) actualizando.value = false
  }
}

onMounted(cargar)
watch([periodo, periodoMasVendidos], cargar)

const resumen = computed(() => {
  if (!mostrado.value) return null
  const { torre, periodo: elegido } = mostrado.value
  const r = torre.resumen
  const perdio = r.gananciaNeta.esNegativo()
  return {
    titulo: tituloDeGanancia(elegido, r.gananciaNeta),
    valor: formatearDinero(perdio ? r.gananciaNeta.negar() : r.gananciaNeta),
    detalle: r.ventas.esCero() ? textoSinVentas(elegido) : `Vendiste ${formatearDinero(r.ventas)}`,
    tono: perdio ? 'peligro' : r.gananciaNeta.esPositivo() ? 'exito' : 'normal',
    filas: [
      { etiqueta: 'Ventas', valor: formatearDinero(r.ventas) },
      { etiqueta: 'Costo de lo vendido', valor: formatearDinero(r.costoVendido) },
      {
        etiqueta: 'Pérdidas (se dañó, se derramó o se venció)',
        valor: formatearDinero(r.mermas),
      },
    ],
    diferencias: formatearDinero(r.diferenciasDeConteo),
  } as const
})

/** RN-AN-19: "No pago" no muestra la tarjeta; sin configurar pregunta; con pago, el avance. */
const alquiler = computed(() => {
  const a = mostrado.value?.torre.alquiler
  if (!a || a.estado === 'NO_PAGA') return null
  if (a.estado === 'SIN_CONFIGURAR')
    return { configurado: false, lineas: [], porcentaje: 0 } as const
  return {
    configurado: true,
    lineas: a.textos.map(pegarCifras),
    porcentaje: a.avance.porcentaje,
  } as const
})

const paraComprar = computed(() => {
  if (!mostrado.value) return null
  const { lineas, total } = mostrado.value.torre.paraComprar
  return {
    cuantos: `${formatearEntero(lineas.length)} ${plural(lineas.length, 'producto', 'productos')}`,
    primeras: lineas.slice(0, LINEAS_EN_EL_RESUMEN).map((l) => ({
      id: l.productoId,
      nombre: l.nombre,
      cantidad: formatearCantidad(l.cantidad, l.unidad),
    })),
    mas: Math.max(0, lineas.length - LINEAS_EN_EL_RESUMEN),
    total: formatearDinero(total),
  }
})

const masVendidos = computed(() => {
  if (!mostrado.value) return null
  const { porVeces, porGanancia } = mostrado.value.torre.masVendidos
  return {
    vacio: textoSinVentas(mostrado.value.periodoMasVendidos === 7 ? '7_DIAS' : '30_DIAS'),
    porVeces: porVeces.map((f) => ({
      id: f.productoId,
      nombre: f.nombre,
      detalle: `${textoVeces(f.veces)} · ${formatearCantidad(f.cantidad, f.unidad)}`,
    })),
    porGanancia: porGanancia.map((f) => ({
      id: f.productoId,
      nombre: f.nombre,
      detalle: `${formatearDinero(f.ganancia)} de ganancia · ${formatearCantidad(f.cantidad, f.unidad)}`,
    })),
  }
})

const semana = computed(() => {
  const s = mostrado.value?.torre.semana
  if (!s) return null
  if (s.tipo === 'sin-datos') return { mensaje: s.mensaje, filas: [] }
  return {
    mensaje: null,
    filas: s.filas.map((f) => ({
      concepto: f.concepto,
      cambio: partesDelCambio(f.cambio),
      actual: formatearDinero(f.actual),
      anterior: formatearDinero(f.anterior),
    })),
  }
})

const mejorDia = computed(() => {
  const m = mostrado.value?.torre.mejorDia
  if (!m) return null
  if (m.tipo === 'insuficiente') return { mensaje: m.mensaje, frase: null, barras: [] }
  return {
    mensaje: null,
    frase: textoMejorDia(m.mejor),
    barras: m.promedios.map((p) => ({
      etiqueta: textoDeDia(p.dia),
      valor: p.promedio.centimos,
      textoValor: formatearDinero(p.promedio),
      destacada: p.dia === m.mejor,
    })),
  }
})

const parados = computed(() => {
  if (!mostrado.value) return null
  const { productos, total } = mostrado.value.torre.parados
  return {
    productos: productos.map((p) => ({
      id: p.productoId,
      nombre: p.nombre,
      dinero: formatearDinero(p.dineroInmovilizado),
      detalle: `${textoSinVender(p.diasSinVender)} · tienes ${formatearCantidad(p.stock, p.unidad)}`,
    })),
    total: formatearDinero(total),
  }
})

const atencion = computed(() => {
  if (!mostrado.value) return null
  const { atencion: cuantos, productosEnAtencion, preciosParaRevisar } = mostrado.value.torre
  return {
    agotados: { cantidad: cuantos.agotados, productos: productosEnAtencion.agotados },
    porAcabarse: {
      cantidad: cuantos.porAcabarse,
      productos: productosEnAtencion.porAcabarse.map((p) => ({
        ...p,
        detalle: [`Quedan ${formatearCantidad(p.stock, p.unidad)}`, p.cobertura]
          .filter(Boolean)
          .join(' · '),
      })),
    },
    precios: {
      cantidad: cuantos.preciosParaRevisar,
      productos: preciosParaRevisar.map((p) => ({
        ...p,
        detalle: textoPerdidaPorUnidad(p.perdidaPorUnidad, p.unidad),
      })),
    },
  }
})

function irA(nombre: 'para-comprar' | 'necesito-comprar' | 'alquiler-del-local'): void {
  void router.push({ name: nombre })
}
</script>

<template>
  <div class="vista-control">
    <EncabezadoPagina titulo="Control" />

    <MensajeDeError
      v-if="fallo && !mostrado"
      mensaje="No pudimos calcular el control"
      ayuda="Vuelve a abrir esta pantalla en un momento."
    />
    <p v-else-if="!mostrado" class="calculando">Calculando…</p>

    <!-- 04-torre-de-control: las secciones en su orden. Desde 768 px, dos columnas
         (06-experiencia-de-uso): la primera con lo de hoy y lo que hay que hacer (1–4), la
         segunda con cómo va el negocio (5–7). Cada columna es un bloque: abrir una lista no
         mueve tarjetas de una columna a la otra, y el orden de lectura sigue siendo el de la spec. -->
    <div
      v-else
      class="tablero"
      :class="{ 'tablero--actualizando': actualizando }"
      :aria-busy="actualizando ? 'true' : 'false'"
    >
      <div class="columna">
        <SeccionDeControl titulo="Resumen" :icono="Wallet">
          <SelectorSegmentado
            v-model="periodo"
            :opciones="OPCIONES_DE_PERIODO"
            etiqueta="Periodo del resumen"
            etiqueta-oculta
          />
          <template v-if="resumen">
            <TarjetaDeCifra
              :titulo="resumen.titulo"
              :texto-valor="resumen.valor"
              :texto-detalle="resumen.detalle"
              :tono="resumen.tono"
            />
            <div class="cifras">
              <FilaDeDato
                v-for="fila in resumen.filas"
                :key="fila.etiqueta"
                :etiqueta="fila.etiqueta"
                :texto-valor="fila.valor"
              />
            </div>
            <div class="aparte">
              <FilaDeDato etiqueta="Diferencias de conteo" :texto-valor="resumen.diferencias" />
              <p class="nota">No cambia la ganancia: es lo que faltó o sobró al contar.</p>
            </div>
          </template>
        </SeccionDeControl>

        <SeccionDeControl v-if="alquiler" titulo="Alquiler del local" :icono="KeyRound">
          <template v-if="alquiler.configurado">
            <p class="linea">{{ alquiler.lineas[0] }}</p>
            <BarraDeProgreso
              :actual="alquiler.porcentaje"
              :total="100"
              :texto="`${alquiler.porcentaje} %`"
              etiqueta="Avance del alquiler del local"
            />
            <p class="linea">{{ alquiler.lineas[1] }}</p>
            <RouterLink :to="{ name: 'alquiler-del-local' }" class="cambiar">
              <span>Cambiar</span>
              <ChevronRight aria-hidden="true" class="flecha" />
            </RouterLink>
          </template>
          <template v-else>
            <p class="pregunta">{{ PREGUNTA_DEL_ALQUILER }}</p>
            <Boton
              :texto="BOTON_CONFIGURAR_ALQUILER"
              :icono="KeyRound"
              @click="irA('alquiler-del-local')"
            />
          </template>
        </SeccionDeControl>

        <SeccionDeControl titulo="Atención" :icono="TriangleAlert">
          <template v-if="atencion">
            <FilaDeAtencion
              etiqueta="Agotados"
              :cantidad="atencion.agotados.cantidad"
              :icono="CircleX"
              tono="peligro"
            >
              <ul class="productos" role="list">
                <li v-for="p in atencion.agotados.productos" :key="p.productoId">
                  <EnlaceAProducto :producto-id="p.productoId">
                    <span class="nombre">{{ pegarCifras(p.nombre) }}</span>
                    <span class="detalle">Agotado</span>
                  </EnlaceAProducto>
                </li>
              </ul>
            </FilaDeAtencion>
            <FilaDeAtencion
              etiqueta="Queda poco"
              :cantidad="atencion.porAcabarse.cantidad"
              :icono="TriangleAlert"
              tono="atencion"
            >
              <ul class="productos" role="list">
                <li v-for="p in atencion.porAcabarse.productos" :key="p.productoId">
                  <EnlaceAProducto :producto-id="p.productoId">
                    <span class="nombre">{{ pegarCifras(p.nombre) }}</span>
                    <span class="detalle">{{ pegarCifras(p.detalle) }}</span>
                  </EnlaceAProducto>
                </li>
              </ul>
            </FilaDeAtencion>
            <FilaDeAtencion
              etiqueta="Precios para revisar"
              :cantidad="atencion.precios.cantidad"
              :icono="Tag"
              tono="atencion"
            >
              <ul class="productos" role="list">
                <li v-for="p in atencion.precios.productos" :key="p.productoId">
                  <EnlaceAProducto :producto-id="p.productoId">
                    <span class="nombre">{{ pegarCifras(p.nombre) }}</span>
                    <span class="detalle">{{ pegarCifras(p.detalle) }}</span>
                  </EnlaceAProducto>
                </li>
              </ul>
            </FilaDeAtencion>
          </template>
        </SeccionDeControl>

        <SeccionDeControl titulo="Para comprar" :icono="ShoppingBasket">
          <template v-if="paraComprar && paraComprar.primeras.length > 0">
            <p class="cuantos">{{ paraComprar.cuantos }}</p>
            <div>
              <FilaDeDato
                v-for="linea in paraComprar.primeras"
                :key="linea.id"
                :etiqueta="linea.nombre"
                :texto-valor="linea.cantidad"
              />
              <p v-if="paraComprar.mas > 0" class="mas">
                y {{ formatearEntero(paraComprar.mas) }} más
              </p>
              <FilaDeDato etiqueta="Total estimado" :texto-valor="paraComprar.total" destacado />
            </div>
            <BotonPrincipal
              texto="Ver la lista para comprar"
              :icono="ShoppingBasket"
              @click="irA('para-comprar')"
            />
          </template>
          <p v-else class="vacio">No hace falta comprar nada por ahora</p>
          <Boton texto="¿Necesito comprar?" :icono="CircleHelp" @click="irA('necesito-comprar')" />
        </SeccionDeControl>

        <SeccionDeControl titulo="Más vendidos" :icono="Trophy">
          <SelectorSegmentado
            v-model="periodoMasVendidos"
            :opciones="OPCIONES_DE_MAS_VENDIDOS"
            etiqueta="Periodo de los más vendidos"
            etiqueta-oculta
          />
          <template v-if="masVendidos">
            <p v-if="masVendidos.porVeces.length === 0" class="vacio">{{ masVendidos.vacio }}</p>
            <template v-else>
              <h3>Los que más se venden</h3>
              <ol class="ranking">
                <li v-for="f in masVendidos.porVeces" :key="f.id">
                  <span class="nombre">{{ pegarCifras(f.nombre) }}</span>
                  <span class="detalle">{{ pegarCifras(f.detalle) }}</span>
                </li>
              </ol>
              <h3>Los que más ganancia dejan</h3>
              <ol class="ranking">
                <li v-for="f in masVendidos.porGanancia" :key="f.id">
                  <span class="nombre">{{ pegarCifras(f.nombre) }}</span>
                  <span class="detalle">{{ pegarCifras(f.detalle) }}</span>
                </li>
              </ol>
            </template>
          </template>
        </SeccionDeControl>
      </div>

      <div class="columna">
        <SeccionDeControl titulo="Semana contra semana" :icono="CalendarRange">
          <template v-if="semana">
            <div v-if="semana.mensaje" class="vacio">
              <p>{{ semana.mensaje }}</p>
              <p class="nota">
                Cuando tengas dos semanas de ventas, aquí verás si vendes más o menos.
              </p>
            </div>
            <template v-else>
              <div v-for="fila in semana.filas" :key="fila.concepto" class="comparacion">
                <h3>{{ fila.concepto }}</h3>
                <p class="cambio" :class="`cambio--${fila.cambio.tono}`">
                  <span class="flecha" aria-hidden="true">{{ fila.cambio.flecha }}</span>
                  {{ ' ' }}<span>{{ fila.cambio.texto }}</span>
                </p>
                <FilaDeDato etiqueta="Esta semana" :texto-valor="fila.actual" />
                <FilaDeDato etiqueta="Semana anterior" :texto-valor="fila.anterior" />
              </div>
              <p class="nota">Los últimos 7 días completos (sin hoy) contra los 7 anteriores.</p>
            </template>
          </template>
        </SeccionDeControl>

        <SeccionDeControl titulo="Mejor día de la semana" :icono="CalendarCheck">
          <template v-if="mejorDia">
            <p v-if="mejorDia.mensaje" class="vacio">{{ mejorDia.mensaje }}</p>
            <template v-else>
              <p class="frase">{{ mejorDia.frase }}</p>
              <GraficoBarras titulo="Venta promedio por día" :barras="mejorDia.barras" />
              <p class="nota">Promedio por día de la semana, sin contar hoy.</p>
            </template>
          </template>
        </SeccionDeControl>

        <SeccionDeControl titulo="Productos parados" :icono="Hourglass">
          <template v-if="parados">
            <div v-if="parados.productos.length === 0" class="vacio">
              <p>Ningún producto está parado</p>
              <p class="nota">Aquí verás lo que no se vende hace 30 días o más.</p>
            </div>
            <template v-else>
              <ul class="parados" role="list">
                <li v-for="p in parados.productos" :key="p.id">
                  <FilaDeDato :etiqueta="p.nombre" :texto-valor="p.dinero" />
                  <p class="detalle">{{ pegarCifras(p.detalle) }}</p>
                </li>
              </ul>
              <FilaDeDato
                class="total"
                etiqueta="Total de dinero parado"
                :texto-valor="parados.total"
                destacado
              />
              <AvisoEnPagina tono="info" :titulo="SUGERENCIA_PARA_PARADOS" />
            </template>
          </template>
        </SeccionDeControl>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calculando {
  color: var(--color-texto-suave);
}
.tablero {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-4);
  transition: opacity 150ms ease-out;
}
/* Al cambiar de periodo se deja lo anterior a la vista (sin parpadeo) hasta que llega lo nuevo. */
.tablero--actualizando {
  opacity: 0.6;
}
.columna {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
  min-inline-size: 0;
}
@media (min-width: 768px) {
  .tablero {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

.aparte {
  padding-top: var(--espacio-2);
  border-top: 2px dashed color-mix(in srgb, var(--color-borde) 45%, transparent);
}
.nota {
  margin: var(--espacio-1) 0 0;
  color: var(--color-texto-suave);
  font-size: 0.95rem;
}
.vacio {
  margin: 0;
  color: var(--color-texto);
  font-weight: 700;
}
.vacio p {
  margin: 0;
}
.vacio .nota {
  font-weight: 400;
}
.cuantos {
  margin: 0;
  font-weight: 700;
}
.mas {
  margin: var(--espacio-1) 0;
  color: var(--color-texto-suave);
}

/* Tarjeta Alquiler del local (RN-AN-19). */
.linea,
.pregunta {
  margin: 0;
  font-weight: 700;
  overflow-wrap: break-word;
}
.cambiar {
  display: inline-flex;
  align-items: center;
  align-self: flex-end;
  gap: var(--espacio-1);
  min-block-size: var(--alto-toque);
  padding-inline: var(--espacio-2);
  color: var(--color-primario);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
.flecha {
  inline-size: 1.25em;
  block-size: 1.25em;
  flex: none;
}

h3 {
  margin: var(--espacio-2) 0 0;
  font-size: 1.05rem;
}

.productos,
.parados {
  margin: 0;
  padding: 0;
  list-style: none;
}
.productos li + li,
.parados li + li {
  border-top: 1px solid color-mix(in srgb, var(--color-borde) 30%, transparent);
}
.nombre {
  font-weight: 700;
}
.detalle {
  color: var(--color-texto-suave);
}
.parados .detalle {
  margin: 0 0 var(--espacio-2);
}

/* Puestos 1, 2, 3… en un círculo; el número lo da la lista ordenada (el lector dice "1 de 3"). */
.ranking {
  counter-reset: puesto;
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-2);
}
.ranking li {
  counter-increment: puesto;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: var(--espacio-3);
  align-items: baseline;
}
.ranking li::before {
  content: counter(puesto);
  grid-row: 1 / span 2;
  display: grid;
  place-items: center;
  inline-size: 1.8em;
  block-size: 1.8em;
  border-radius: 999px;
  background: var(--color-primario-suave);
  color: var(--color-primario);
  font-weight: 700;
}
.ranking .nombre,
.ranking .detalle {
  grid-column: 2;
}

.comparacion {
  padding-bottom: var(--espacio-2);
}
.comparacion + .comparacion {
  padding-top: var(--espacio-2);
  border-top: 1px solid color-mix(in srgb, var(--color-borde) 30%, transparent);
}
.cambio {
  margin: var(--espacio-1) 0;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-texto);
}
.flecha {
  display: inline-block;
}
.cambio--sube .flecha {
  color: var(--color-exito);
}
.cambio--baja .flecha {
  color: var(--color-peligro);
}

.frase {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
}
</style>
