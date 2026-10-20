<script setup lang="ts">
/**
 * Catálogo SOLO PARA PRUEBAS del kit A (plan 09b): muestra cada componente de productos,
 * carrito y total con datos de ejemplo para que las E2E (e2e/kit-productos.spec.ts) midan su
 * geometría a 320/360/768/1280 px con letra Muy grande y pasen axe. Lo monta el gancho de
 * pruebas (`window.__pruebas.mostrarCatalogo('productos')`, src/app/ganchos-de-prueba.ts), que
 * solo existe en desarrollo o bajo un navegador automatizado: una persona nunca lo ve.
 *
 * Las cuentas de aquí (importes) son de mentira, con números de JavaScript: en las
 * pantallas reales las hace el dominio (Dinero/Cantidad) y llegan ya formateadas.
 */
import { computed, ref } from 'vue'
import { ShoppingCart } from 'lucide-vue-next'
import { normalizar } from '@/shared/domain/texto'
import AccesosRapidos from '../componentes/AccesosRapidos.vue'
import BarraDeTotal from '../componentes/BarraDeTotal.vue'
import BuscadorGrande from '../componentes/BuscadorGrande.vue'
import CampoFoto from '../componentes/CampoFoto.vue'
import FilaDeCarrito from '../componentes/FilaDeCarrito.vue'
import FotoDeProducto from '../componentes/FotoDeProducto.vue'
import ListaDeProductos from '../componentes/ListaDeProductos.vue'
import TarjetaDeProducto from '../componentes/TarjetaDeProducto.vue'
import type { ProductoDeLista } from '../tipos-de-productos'

/** Dibujo de un envase (SVG) como Blob, para probar la foto guardada en IndexedDB. */
function envase(fondo: string, cuerpo: string, tapa: string): Blob {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <rect width="120" height="120" fill="${fondo}"/>
    <rect x="50" y="14" width="20" height="14" rx="3" fill="${tapa}"/>
    <path d="M44 30h32l6 14v58a8 8 0 0 1-8 8H46a8 8 0 0 1-8-8V44z" fill="${cuerpo}"/>
    <rect x="44" y="56" width="32" height="26" rx="4" fill="#ffffff" opacity="0.85"/>
  </svg>`
  return new Blob([svg], { type: 'image/svg+xml' })
}

const FOTOS = {
  lejia: envase('#dfeef6', '#2f6fa3', '#f2c230'),
  detergente: envase('#f6ecdf', '#c2410c', '#1f2937'),
  lavavajillas: envase('#e6f4ea', '#2f8a4a', '#f8fafc'),
}
/** Una foto como dirección (string) en vez de Blob. */
const FOTO_COMO_DIRECCION = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#efe7f7"/><circle cx="60" cy="64" r="34" fill="#6d28d9"/><rect x="48" y="16" width="24" height="18" rx="4" fill="#111827"/></svg>',
)}`

const PRODUCTOS: ProductoDeLista[] = [
  {
    id: 'p-1',
    nombre: 'Lejía Clorox 1 L',
    categoria: 'Lejías y desinfectantes',
    imagen: FOTOS.lejia,
    textoStock: '12 unid.',
    textoPrecio: 'S/ 4.50',
    estado: 'POR_ACABARSE',
    textoSecundario: 'Se acaba en ~4 días',
  },
  {
    id: 'p-2',
    nombre: 'Detergente en polvo Bolívar Active Care aroma lavanda 2.6 kg',
    categoria: 'Detergentes y jabones',
    imagen: FOTOS.detergente,
    textoStock: '3 unid.',
    textoPrecio: 'S/ 32.90',
    estado: 'NORMAL',
  },
  {
    id: 'p-3',
    nombre: 'Limpiavidrios Desinfectante',
    categoria: 'Limpiadores y ceras',
    textoStock: 'Agotado',
    textoPrecio: 'S/ 7.20',
    estado: 'AGOTADO',
    textoSecundario: 'Se acabó hace 2 días',
  },
  {
    id: 'p-4',
    nombre: 'Bolsa negra 140 L',
    categoria: 'Bolsas',
    imagen: FOTO_COMO_DIRECCION,
    textoStock: '48 unid.',
    textoPrecio: 'S/ 0.50',
  },
  {
    id: 'p-5',
    nombre: 'Carbón vegetal',
    categoria: 'Carbón y combustibles',
    textoStock: '2.5 kg',
  },
]

// --- Buscador + lista -------------------------------------------------------------------
const busqueda = ref('')
const resultados = computed(() => {
  const texto = normalizar(busqueda.value)
  return texto === '' ? PRODUCTOS : PRODUCTOS.filter((p) => normalizar(p.nombre).includes(texto))
})
const ultimoElegido = ref('')
function elegir(id: string) {
  ultimoElegido.value = PRODUCTOS.find((p) => p.id === id)?.nombre ?? id
}

const MAS_VENDIDOS = [
  { id: 'p-1', nombre: 'Lejía Clorox 1 L', imagen: FOTOS.lejia },
  { id: 'p-6', nombre: 'Lavavajillas Ayudín limón', imagen: FOTOS.lavavajillas },
  { id: 'p-4', nombre: 'Bolsa negra 140 L', imagen: FOTO_COMO_DIRECCION },
  { id: 'p-3', nombre: 'Limpiavidrios', categoria: 'Limpiadores y ceras' },
  { id: 'p-7', nombre: 'Papel higiénico Elite x4', categoria: 'Papel y descartables' },
  { id: 'p-8', nombre: 'Escoba', categoria: 'Escobas, trapeadores y accesorios' },
  { id: 'p-9', nombre: 'Desinfectante', categoria: 'Lejías y desinfectantes' },
  { id: 'p-10', nombre: 'Insecticida Raid', categoria: 'Ambientadores e insecticidas' },
  { id: 'p-11', nombre: 'Noveno (no se muestra)', categoria: 'Otros' },
]

// --- Carrito ----------------------------------------------------------------------------
interface LineaDeEjemplo {
  id: string
  nombre: string
  imagen?: Blob
  categoria?: string
  unidad: 'UNIDAD' | 'KILO'
  cantidad: string
  precio: string
  especial: boolean
}
const lineas = ref<LineaDeEjemplo[]>([
  {
    id: 'l-1',
    nombre: 'Lejía Clorox 1 L',
    imagen: FOTOS.lejia,
    unidad: 'UNIDAD',
    cantidad: '2',
    precio: '4.50',
    especial: false,
  },
  {
    id: 'l-2',
    nombre: 'Carbón vegetal',
    categoria: 'Carbón y combustibles',
    unidad: 'KILO',
    cantidad: '1.5',
    precio: '3.75',
    especial: false,
  },
])
/** RN-OP-22: la línea compacta del panel de venta (celular), con precio especial y "quedan". */
const cantidadCompacta = ref('3')
const numero = (texto: string) => Number(texto.replace(',', '.')) || 0
const soles = (valor: number) => `S/ ${valor.toFixed(2)}`
const importe = (linea: LineaDeEjemplo) => numero(linea.cantidad) * numero(linea.precio)
const total = computed(() => lineas.value.reduce((suma, linea) => suma + importe(linea), 0))
/** Como una pantalla real: valida en el acto (sincrónico) y, si no sirve, deja el error al
 * lado del campo; la fila queda abierta (contrato de errorPrecio en FilaDeCarrito). */
const erroresDePrecio = ref<Record<string, string | undefined>>({})
function cambiarPrecio(linea: LineaDeEjemplo, precio: string) {
  if (!/^\d+([.,]\d{1,2})?$/.test(precio.trim())) {
    erroresDePrecio.value[linea.id] = 'Escribe un precio válido, por ejemplo 4.50'
    return
  }
  erroresDePrecio.value[linea.id] = undefined
  linea.precio = precio.trim().replace(',', '.')
  linea.especial = true
}
/** RN-UX-07: qué pasó y qué hacer, junto al campo de cantidad. */
function errorDeCantidad(linea: LineaDeEjemplo): string | undefined {
  if (linea.unidad !== 'KILO' || numero(linea.cantidad) <= 2.5) return undefined
  return `Solo quedan 2.5 kg de ${linea.nombre}. Cambia la cantidad o registra la llegada de mercadería.`
}
function quitar(id: string) {
  lineas.value = lineas.value.filter((linea) => linea.id !== id)
}

// --- Foto -------------------------------------------------------------------------------
const foto = ref<Blob | null>(null)
const errorDeFoto = ref('')
function alCambiarFoto(nueva: Blob | null) {
  foto.value = nueva
  errorDeFoto.value = ''
}

const confirmaciones = ref(0)
</script>

<template>
  <section class="catalogo-kit-productos" aria-labelledby="catalogo-kit-productos-titulo">
    <h2 id="catalogo-kit-productos-titulo">Kit de productos</h2>
    <p class="nota">Página de prueba: cada componente con datos de ejemplo.</p>

    <section class="muestra" aria-labelledby="muestra-foto">
      <h3 id="muestra-foto">FotoDeProducto</h3>
      <div class="fotos">
        <FotoDeProducto :imagen="FOTOS.lejia" nombre="Lejía Clorox 1 L" tamano="chica" />
        <FotoDeProducto :imagen="FOTOS.detergente" nombre="Detergente Bolívar" tamano="mediana" />
        <FotoDeProducto nombre="Lavavajillas sin foto" categoria="Lavavajillas" tamano="mediana" />
        <FotoDeProducto nombre="Producto sin categoría" tamano="chica" />
        <FotoDeProducto
          imagen="data:image/png;base64,no-es-una-foto"
          nombre="Foto dañada"
          categoria="Bolsas"
          tamano="chica"
        />
      </div>
      <FotoDeProducto
        :imagen="FOTO_COMO_DIRECCION"
        nombre="Bolsa negra 140 L (grande)"
        tamano="grande"
      />
    </section>

    <section class="muestra" aria-labelledby="muestra-tarjeta">
      <h3 id="muestra-tarjeta">TarjetaDeProducto</h3>
      <div class="pila">
        <TarjetaDeProducto
          v-for="producto in PRODUCTOS.slice(0, 3)"
          :key="producto.id"
          v-bind="producto"
          @elegir="elegir(producto.id)"
        />
      </div>
      <p class="eco" data-prueba="ultimo-elegido">Elegiste: {{ ultimoElegido || 'nada' }}</p>
    </section>

    <section class="muestra" aria-labelledby="muestra-buscador">
      <h3 id="muestra-buscador">BuscadorGrande + ListaDeProductos</h3>
      <BuscadorGrande v-model="busqueda" etiqueta="Buscar producto" marcador="Ej.: lejía" />
      <p class="eco" data-prueba="eco-busqueda">Buscando: «{{ busqueda }}»</p>
      <ListaDeProductos
        etiqueta="Resultados"
        :productos="resultados"
        :vacio="{
          titulo: 'No encontramos ese producto',
          descripcion: 'Revisa cómo está escrito o agrégalo.',
          accion: 'Agregar producto',
        }"
        @elegir="elegir"
      />
    </section>

    <section class="muestra" aria-labelledby="muestra-vacia">
      <h3 id="muestra-vacia">ListaDeProductos vacía</h3>
      <ListaDeProductos
        :productos="[]"
        :vacio="{
          titulo: 'Aún no tienes productos',
          descripcion: 'Agrega el primero para empezar a vender.',
          accion: 'Agregar el primero',
        }"
      />
    </section>

    <section class="muestra" aria-labelledby="muestra-accesos">
      <h3 id="muestra-accesos">AccesosRapidos</h3>
      <AccesosRapidos :productos="MAS_VENDIDOS" @elegir="elegir" />
    </section>

    <section class="muestra" aria-labelledby="muestra-carrito">
      <h3 id="muestra-carrito">FilaDeCarrito</h3>
      <ul class="pila carrito" role="list" aria-label="Carrito">
        <li v-for="linea in lineas" :key="linea.id">
          <FilaDeCarrito
            v-model:cantidad="linea.cantidad"
            :nombre="linea.nombre"
            :imagen="linea.imagen"
            :categoria="linea.categoria"
            :unidad="linea.unidad"
            :texto-precio="`${soles(numero(linea.precio))} c/u`"
            :texto-importe="soles(importe(linea))"
            :texto-precio-especial="linea.especial ? 'Precio especial' : undefined"
            :valor-precio="linea.precio"
            :precio-editable="linea.unidad === 'UNIDAD'"
            :error-precio="erroresDePrecio[linea.id]"
            :error-cantidad="errorDeCantidad(linea)"
            @cambiar-precio="cambiarPrecio(linea, $event)"
            @cancelar-precio="erroresDePrecio[linea.id] = undefined"
            @quitar="quitar(linea.id)"
          />
        </li>
      </ul>
    </section>

    <section class="muestra" aria-labelledby="muestra-carrito-compacto">
      <h3 id="muestra-carrito-compacto">FilaDeCarrito compacta (panel de venta)</h3>
      <FilaDeCarrito
        v-model:cantidad="cantidadCompacta"
        nombre="Jabón Bolívar con un nombre largo de ejemplo"
        unidad="UNIDAD"
        texto-precio="S/ 120.50 c/u"
        :texto-importe="soles(numero(cantidadCompacta) * 120.5)"
        texto-quedan="Quedan 1,250 unid."
        texto-precio-especial="Precio especial"
        valor-precio="120.50"
        precio-editable
        compacta
      />
    </section>

    <section class="muestra" aria-labelledby="muestra-foto-campo">
      <h3 id="muestra-foto-campo">CampoFoto</h3>
      <CampoFoto
        :model-value="foto"
        etiqueta="Foto del producto"
        nombre="Lejía Clorox 1 L"
        categoria="Lejías y desinfectantes"
        @update:model-value="alCambiarFoto"
        @error="errorDeFoto = $event"
      />
      <p v-if="errorDeFoto" class="eco" role="alert">{{ errorDeFoto }}</p>
    </section>

    <!-- Al final y directo en la columna: va pegada abajo mientras se recorre todo el catálogo. -->
    <p class="eco" data-prueba="confirmaciones">Confirmaciones: {{ confirmaciones }}</p>
    <BarraDeTotal
      etiqueta="Total"
      :texto-total="soles(total)"
      texto-accion="Confirmar venta"
      :icono="ShoppingCart"
      :deshabilitado="lineas.length === 0"
      @accion="confirmaciones += 1"
    />
  </section>
</template>

<style scoped>
.catalogo-kit-productos {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-6);
  margin-block-start: var(--espacio-6);
  padding-block-start: var(--espacio-4);
  border-top: 2px dashed var(--color-borde);
}
h2,
h3 {
  margin: 0;
}
h2 {
  font-size: 1.3rem;
}
h3 {
  font-size: 1.1rem;
  margin-block-end: var(--espacio-3);
}
.nota,
.eco {
  margin: 0;
  color: var(--color-texto-suave);
}
.eco {
  margin-block-start: var(--espacio-2);
}
.muestra {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-3);
  min-inline-size: 0;
}
.fotos {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--espacio-3);
}
.pila {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
