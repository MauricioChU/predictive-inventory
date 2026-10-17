import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { Aplicacion } from '@/app/composicion'
import { proveerAplicacion } from '@/app/proveer-aplicacion'
import type { ProductoVista } from '@/modules/catalogo'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { CLAVE_ANUNCIADOR, crearAnunciador, ESPERA_ANUNCIO_MS } from '@/shared/ui/anunciador'
import { usarCarrito } from './carrito-de-pantalla'
import { usarCarritoAlDia } from './usar-carrito-al-dia'

function producto(id: string, nombre: string, extra: Partial<ProductoVista> = {}): ProductoVista {
  return {
    id,
    nombre,
    categoriaId: 'otros',
    categoriaNombre: 'Otros',
    unidad: 'UNIDAD',
    precioCompra: Dinero.deTexto('2.40'),
    precioVenta: Dinero.deTexto('3.50'),
    gananciaPorUnidad: Dinero.deTexto('1.10'),
    stockMinimo: Cantidad.deEntero(3),
    stock: Cantidad.deEntero(10),
    activo: true,
    tieneFoto: false,
    ...extra,
  }
}

const LEJIA = producto('lejia', 'Lejía 1 L')
const CARBON = producto('carbon', 'Carbón')
const ESCOBA = producto('escoba', 'Escoba')

/** Los productos "de ahora" que devuelve obtenerProducto (se cambian entre refrescos). */
let actuales = new Map<string, ProductoVista>()
const obtenerProducto = vi.fn(async (id: string) => actuales.get(id) ?? null)

function montar() {
  const carrito = usarCarrito('venta')
  for (const p of [LEJIA, CARBON, ESCOBA]) carrito.agregar(p)
  actuales = new Map([LEJIA, CARBON, ESCOBA].map((p) => [p.id, p]))
  const anunciador = crearAnunciador()
  let alDia!: ReturnType<typeof usarCarritoAlDia>
  const Arnes = defineComponent({
    setup() {
      alDia = usarCarritoAlDia(carrito)
      return () => h('h1', 'Vender')
    },
  })
  const app = { catalogo: { obtenerProducto } } as unknown as Aplicacion
  const w = mount(Arnes, {
    global: { plugins: [proveerAplicacion(app)], provide: { [CLAVE_ANUNCIADOR]: anunciador } },
  })
  return { w, carrito, anunciador, alDia: () => alDia }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('plan 17: usarCarritoAlDia', () => {
  it('si no se pueden volver a leer los productos, se registra y no queda un rechazo sin manejar', async () => {
    const registro = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    obtenerProducto.mockRejectedValueOnce(new Error('base cerrada'))
    const { alDia, carrito } = montar() // onMounted(refrescar) falla
    await flushPromises()
    expect(registro).toHaveBeenCalledWith('No se pudo poner al día el carrito:', expect.any(Error))
    expect(alDia().quitados.value).toEqual([])
    expect(carrito.lineas.value).toHaveLength(3) // el carrito queda como estaba

    obtenerProducto.mockRejectedValueOnce(new Error('otra vez'))
    await expect(alDia().refrescar()).resolves.toBeUndefined()
  })

  it('un segundo refresco no pisa los nombres de un aviso todavía abierto', async () => {
    vi.useFakeTimers()
    const { alDia, anunciador } = montar()
    await flushPromises()
    actuales.set('carbon', { ...CARBON, activo: false })
    await alDia().refrescar()
    expect(alDia().quitados.value).toEqual(['Carbón'])
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)

    // Con el aviso abierto, otro producto deja de estar a la venta.
    actuales.set('escoba', { ...ESCOBA, activo: false })
    await alDia().refrescar()
    expect(alDia().quitados.value).toEqual(['Carbón', 'Escoba'])
    expect(alDia().textoDeQuitados.value).toBe('Quitamos Carbón y Escoba: ya no están a la venta')
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    expect(anunciador.texto.value).toBe('Quitamos Carbón y Escoba: ya no están a la venta')

    // Cerrado el aviso, uno nuevo dice solo lo nuevo.
    await alDia().cerrarAviso()
    actuales.set('lejia', { ...LEJIA, activo: false })
    await alDia().refrescar()
    expect(alDia().quitados.value).toEqual(['Lejía 1 L'])
  })
})
