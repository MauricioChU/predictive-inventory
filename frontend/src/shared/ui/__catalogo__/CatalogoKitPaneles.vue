<script setup lang="ts">
/**
 * Catálogo del kit B (paneles), SOLO para pruebas: lo monta `window.__pruebas.mostrarCatalogo
 * ('paneles')` (src/app/ganchos-de-prueba.ts) para que e2e/kit-paneles.spec.ts mida cada
 * componente a 320–1280 px con letra Muy grande y lo audite con axe antes de que existan las
 * pantallas reales. No se carga en la app normal (import dinámico solo desde el gancho).
 */
import { computed, provide, ref } from 'vue'
import { CalendarX, Droplet, Droplets, Package, PackageX, Weight } from 'lucide-vue-next'
import { CLAVE_ANUNCIADOR, crearAnunciador } from '../anunciador'
import AvisoEnPagina from '../componentes/AvisoEnPagina.vue'
import BarraDeProgreso from '../componentes/BarraDeProgreso.vue'
import Boton from '../componentes/Boton.vue'
import BotonesDeOpcion from '../componentes/BotonesDeOpcion.vue'
import CarruselDeAvisos, { type AvisoDelCarrusel } from '../componentes/CarruselDeAvisos.vue'
import FilaDeDato from '../componentes/FilaDeDato.vue'
import ListaAgrupadaPorDia from '../componentes/ListaAgrupadaPorDia.vue'
import MensajeDeError from '../componentes/MensajeDeError.vue'
import RespuestaGrande from '../componentes/RespuestaGrande.vue'
import SelectorSegmentado from '../componentes/SelectorSegmentado.vue'
import TarjetaDeCifra from '../componentes/TarjetaDeCifra.vue'

// Montado con su propio createApp (fuera de LayoutApp): trae su anunciador y su región viva,
// para poder ver (y probar) lo que anuncia RespuestaGrande.
const anunciador = crearAnunciador()
provide(CLAVE_ANUNCIADOR, anunciador)

const AVISOS_DEL_CARRUSEL: AvisoDelCarrusel[] = [
  { id: 'a', tono: 'atencion', texto: '4 productos se acaban', textoAccion: 'Ver productos' },
  {
    id: 'b',
    tono: 'info',
    texto: 'Hace 9 días que no guardas una copia',
    textoAccion: 'Guardar copia',
  },
  { id: 'c', tono: 'exito', texto: 'Ayer vendiste S/ 162.50 y ganaste S/ 48.20' },
]

const estado = ref('poco')
const ESTADOS = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'poco', etiqueta: 'Queda poco' },
  { valor: 'agotados', etiqueta: 'Agotados' },
  { valor: 'archivados', etiqueta: 'Archivados' },
]

const motivo = ref<string | null>('DERRAMADO')
const MOTIVOS = [
  { valor: 'DANADO', etiqueta: 'Se dañó', icono: PackageX },
  { valor: 'DERRAMADO', etiqueta: 'Se derramó', icono: Droplets },
  { valor: 'VENCIDO', etiqueta: 'Se venció', icono: CalendarX },
]
const unidad = ref<string | null>(null)
const UNIDADES = [
  { valor: 'UNIDAD', etiqueta: 'Por unidad', icono: Package },
  { valor: 'KILO', etiqueta: 'Por kilo', icono: Weight },
  { valor: 'LITRO', etiqueta: 'Por litro', icono: Droplet },
]

const avisos = ref({ comprar: true, copia: true, resumen: true })

interface Operacion {
  id: string
  hora: string
  tipo: string
  texto: string
}
const HOY = '2026-10-16'
const HISTORIAL: { dia: string; items: Operacion[] }[] = [
  {
    dia: '2026-10-16',
    items: [
      { id: 'v3', hora: '10:42', tipo: 'Venta', texto: 'S/ 14.63' },
      { id: 'v2', hora: '09:15', tipo: 'Llegó mercadería', texto: 'S/ 1 250.00' },
    ],
  },
  { dia: '2026-10-15', items: [{ id: 'v1', hora: '18:03', tipo: 'Se derramó', texto: '1 L' }] },
  {
    dia: '2026-10-12',
    items: [{ id: 'c1', hora: '08:30', tipo: 'Contar stock', texto: '24 unid.' }],
  },
  { dia: '2026-10-01', items: [{ id: 'v0', hora: '12:00', tipo: 'Venta', texto: 'S/ 3.50' }] },
]

const contados = ref(1)
const TOTAL_A_CONTAR = 3

const respuesta = ref<'comprar' | 'alcanza' | 'no-compres'>('comprar')
const RESPUESTAS = {
  comprar: { texto: 'Sí, compra ~12 unid.', tono: 'atencion' },
  alcanza: { texto: 'No hace falta: te alcanza para ~20 días', tono: 'exito' },
  'no-compres': { texto: 'No compres: no se vende hace 45 días', tono: 'peligro' },
} as const
const OPCIONES_DE_RESPUESTA = [
  { valor: 'comprar', etiqueta: 'Comprar' },
  { valor: 'alcanza', etiqueta: 'Alcanza' },
  { valor: 'no-compres', etiqueta: 'No compres' },
] as const
const respuestaActual = computed(() => RESPUESTAS[respuesta.value])
</script>

<template>
  <div class="catalogo-kit-paneles">
    <p role="status" aria-live="polite" class="solo-lector" data-prueba="anuncios-del-catalogo">
      {{ anunciador.texto.value }}
    </p>

    <section class="seccion" aria-labelledby="catalogo-selector-segmentado">
      <h2 id="catalogo-selector-segmentado">SelectorSegmentado</h2>
      <SelectorSegmentado v-model="estado" :opciones="ESTADOS" etiqueta="Mostrar" />
    </section>

    <section class="seccion" aria-labelledby="catalogo-botones-de-opcion">
      <h2 id="catalogo-botones-de-opcion">BotonesDeOpcion</h2>
      <BotonesDeOpcion v-model="motivo" :opciones="MOTIVOS" etiqueta="¿Qué pasó?" />
      <BotonesDeOpcion
        v-model="unidad"
        :opciones="UNIDADES"
        etiqueta="¿Cómo se vende?"
        :error="unidad === null ? 'Elige cómo se vende el producto.' : undefined"
      />
    </section>

    <section class="seccion" aria-labelledby="catalogo-tarjeta-de-cifra">
      <h2 id="catalogo-tarjeta-de-cifra">TarjetaDeCifra</h2>
      <div class="rejilla">
        <TarjetaDeCifra
          titulo="Hoy ganaste"
          texto-valor="S/ 48.20"
          texto-detalle="Vendiste S/ 162.50"
          tono="exito"
        />
        <TarjetaDeCifra titulo="Vendiste este mes" texto-valor="S/ 112 345.67" />
        <TarjetaDeCifra
          titulo="Perdiste por productos dañados"
          texto-valor="S/ 3.00"
          texto-detalle="2 productos esta semana"
          tono="peligro"
        />
      </div>
    </section>

    <section class="seccion" aria-labelledby="catalogo-aviso-en-pagina">
      <h2 id="catalogo-aviso-en-pagina">AvisoEnPagina</h2>
      <AvisoEnPagina
        v-if="avisos.comprar"
        tono="atencion"
        titulo="4 productos se acaban"
        texto-accion="Ver qué comprar"
      />
      <AvisoEnPagina
        v-if="avisos.copia"
        tono="info"
        titulo="Hace 9 días que no guardas una copia"
        texto="Si el celular se malogra, la copia guarda tus productos y ventas."
        texto-accion="Guardar copia"
        texto-cerrar="Ahora no"
        @cerrar="avisos.copia = false"
      />
      <AvisoEnPagina
        v-if="avisos.resumen"
        tono="exito"
        titulo="Resumen de ayer"
        texto="Vendiste S/ 162.50 y ganaste S/ 48.20."
        texto-cerrar="Cerrar"
        @cerrar="avisos.resumen = false"
      />
    </section>

    <section class="seccion" aria-labelledby="catalogo-carrusel-de-avisos">
      <h2 id="catalogo-carrusel-de-avisos">CarruselDeAvisos</h2>
      <CarruselDeAvisos :avisos="AVISOS_DEL_CARRUSEL" etiqueta="Avisos" />
    </section>

    <section class="seccion" aria-labelledby="catalogo-lista-agrupada-por-dia">
      <h2 id="catalogo-lista-agrupada-por-dia">ListaAgrupadaPorDia</h2>
      <ListaAgrupadaPorDia
        :grupos="HISTORIAL"
        :hoy="HOY"
        :nivel-encabezado="3"
        :clave-de="(operacion) => operacion.id"
      >
        <template #default="{ item }">
          <FilaDeDato :etiqueta="`${item.hora} · ${item.tipo}`" :texto-valor="item.texto" />
        </template>
      </ListaAgrupadaPorDia>
    </section>

    <section class="seccion" aria-labelledby="catalogo-barra-de-progreso">
      <h2 id="catalogo-barra-de-progreso">BarraDeProgreso</h2>
      <BarraDeProgreso
        :actual="contados"
        :total="TOTAL_A_CONTAR"
        :texto="`Llevas ${contados} de ${TOTAL_A_CONTAR}`"
      />
      <Boton
        texto="Contar otro"
        :deshabilitado="contados >= TOTAL_A_CONTAR"
        @click="contados = Math.min(TOTAL_A_CONTAR, contados + 1)"
      />
      <BarraDeProgreso :actual="23" :total="80" texto="Llevas 23 de 80" etiqueta="Conteo" />
    </section>

    <section class="seccion" aria-labelledby="catalogo-mensaje-de-error">
      <h2 id="catalogo-mensaje-de-error">MensajeDeError</h2>
      <MensajeDeError
        mensaje="Solo quedan 2 unid. de Lejía 1 L."
        ayuda="Cambia la cantidad o registra la llegada de mercadería."
      />
    </section>

    <section class="seccion" aria-labelledby="catalogo-fila-de-dato">
      <h2 id="catalogo-fila-de-dato">FilaDeDato</h2>
      <div>
        <FilaDeDato etiqueta="Producto" texto-valor="Detergente Bolívar multiusos 2.6 kg" />
        <FilaDeDato etiqueta="Stock" texto-valor="12 unid." />
        <FilaDeDato etiqueta="Se acaba en" texto-valor="~4 días" />
        <FilaDeDato etiqueta="Precio de venta" texto-valor="S/ 4.50" />
        <FilaDeDato etiqueta="Costo" texto-valor="S/ 3.20" />
        <FilaDeDato etiqueta="Ganancia por unidad" texto-valor="S/ 1.30" destacado />
      </div>
    </section>

    <section class="seccion" aria-labelledby="catalogo-respuesta-grande">
      <h2 id="catalogo-respuesta-grande">RespuestaGrande</h2>
      <SelectorSegmentado
        v-model="respuesta"
        :opciones="OPCIONES_DE_RESPUESTA"
        etiqueta="Respuesta de ejemplo"
      />
      <RespuestaGrande :texto="respuestaActual.texto" :tono="respuestaActual.tono" />
    </section>

    <section class="seccion" aria-labelledby="catalogo-casos-limite">
      <h2 id="catalogo-casos-limite">Casos límite</h2>
      <p>
        El monto más grande de la app (S/ 99 999.99), una respuesta larga y cajas dentro de un
        contenedor que se ajusta a su contenido (flex con align-items: flex-start).
      </p>
      <div class="envoltorio-encogible">
        <TarjetaDeCifra titulo="Vendiste este año" texto-valor="S/ 99 999.99" />
        <RespuestaGrande texto="No hace falta: te alcanza para ~12 días" tono="exito" />
        <AvisoEnPagina tono="info" titulo="Hoy vendiste S/ 1 162.50" />
        <MensajeDeError mensaje="Solo quedan 2 unid. de Lejía 1 L." />
      </div>
    </section>
  </div>
</template>

<style scoped>
.catalogo-kit-paneles {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-6);
  padding-block: var(--espacio-4);
}
.seccion {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
}
h2 {
  margin: 0;
  padding-bottom: var(--espacio-2);
  border-bottom: 3px solid var(--color-primario);
  font-size: 1.25rem;
}
/* Como en Inicio/Control: tarjetas lado a lado si caben, una por fila en celular. */
.rejilla {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  gap: var(--espacio-4);
}
/* M3: un contexto "shrink-to-fit" donde una caja con container-type sin ancho propio colapsa. */
.envoltorio-encogible {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--espacio-4);
}
</style>
