import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { instanteLocal } from '@/shared/domain/fecha'
import { crearAplicacionDePrueba, type AplicacionDePrueba } from '../soporte/aplicacion-de-prueba'
import { capturarDescargas, elegirArchivo, type Descarga } from '../soporte/archivos-en-pantalla'
import { esperarPantalla, montarPantalla, type PantallaMontada } from '../soporte/montar-pantalla'

const HOY = instanteLocal('2026-10-15 20:30')

const ENCABEZADOS = [
  'nombre',
  'categoría',
  'unidad',
  'precio de compra',
  'precio de venta',
  'stock mínimo',
  'stock inicial',
]
/** El Excel del escenario RN-RE-07 de respaldo.feature (filas 2 a 5). */
const FILAS_DEL_ESCENARIO = [
  ENCABEZADOS,
  ['Jabón Bolívar', 'Detergentes', 'unid', '1.20', '2.00', '5', '24'],
  ['Ambientador Glade', 'Ambientadores', 'unid', '6.50', '9.00', '2', '6'],
  ['Cera roja', 'Limpiadores', 'L', '8.00', '', '1', ''],
  ['Bolsas chicas', 'Bolsas', 'unid', '0.05', '0.10', '1.5', '100'],
]

describe('Importar productos', () => {
  let app: AplicacionDePrueba
  let pantalla: PantallaMontada | undefined
  let descargas: Descarga[]

  function boton(texto: string) {
    return pantalla!.wrapper.findAll('button').find((b) => b.text().trim() === texto)
  }

  async function tocar(texto: string): Promise<void> {
    const encontrado = boton(texto)
    if (!encontrado) throw new Error(`No hay un botón "${texto}" en: ${pantalla!.wrapper.text()}`)
    await encontrado.trigger('click')
    await esperarPantalla()
  }

  async function cargarExcel(filas: string[][], ruta = '/ajustes/importar'): Promise<void> {
    app.lectorDeExcel.fijarFilas(filas)
    pantalla = await montarPantalla(app, ruta)
    const input = pantalla.wrapper.get('input[type="file"]').element as HTMLInputElement
    await elegirArchivo(input, new File(['xlsx'], 'productos.xlsx'))
    await esperarPantalla()
  }

  async function nombresEnElCatalogo(): Promise<string[]> {
    return (await app.catalogo.buscarProductos({ texto: '' })).map((p) => p.nombre).sort()
  }

  beforeEach(async () => {
    app = crearAplicacionDePrueba({ ahora: HOY })
    await app.tienda.completarPrimeraVez({ nombreTienda: 'Bodega Rosita', tamanoDeLetra: 'GRANDE' })
    descargas = capturarDescargas()
  })

  afterEach(async () => {
    pantalla?.wrapper.unmount()
    pantalla = undefined
    vi.restoreAllMocks()
    await app.cerrar()
  })

  it('RN-RE-07: ofrece la plantilla con sus columnas', async () => {
    pantalla = await montarPantalla(app, '/ajustes/importar')
    expect(pantalla.wrapper.get('h1').text()).toBe('Importar productos')

    await tocar('Descargar la plantilla')

    expect(descargas.map((d) => d.nombre)).toEqual(['plantilla-de-productos.xlsx'])
    expect(app.generadorDeExcel.hojasGeneradas[0]!.columnas).toEqual(ENCABEZADOS)
  })

  it('RN-RE-07: la vista previa explica cada problema en lenguaje simple e importa solo las filas válidas', async () => {
    await cargarExcel(FILAS_DEL_ESCENARIO)

    const texto = pantalla!.wrapper.text()
    expect(texto).toContain('2 productos listos para cargar')
    expect(texto).toContain('Jabón Bolívar')
    expect(texto).toContain('Ambientador Glade')
    expect(texto).toContain('2 filas con problema')
    expect(texto).toContain('Fila 4: falta el precio de venta')
    expect(texto).toContain('Fila 5: Bolsas chicas se cuenta por unidades enteras')
    expect(await nombresEnElCatalogo()).toEqual([])

    await tocar('Cargar 2 productos')

    expect(await nombresEnElCatalogo()).toEqual(['Ambientador Glade', 'Jabón Bolívar'])
    expect(pantalla!.wrapper.get('h1').text()).toBe('Se cargaron 2 productos')
    await tocar('Volver a Ajustes')
    expect(pantalla!.router.currentRoute.value.name).toBe('ajustes')
  })

  it('RN-UX-15: la vista previa se anuncia con sus cuentas', async () => {
    await cargarExcel(FILAS_DEL_ESCENARIO)

    expect(await pantalla!.anunciado()).toContain(
      '2 productos listos para cargar, 2 filas con problema',
    )
  })

  it('primera vez: después de cargar sigue con "Ahora contemos lo que tienes"', async () => {
    await cargarExcel(FILAS_DEL_ESCENARIO, '/ajustes/importar?desde=primera-vez')

    await tocar('Cargar 2 productos')
    await tocar('Seguir')

    expect(pantalla!.router.currentRoute.value.name).toBe('primera-vez')
    expect(pantalla!.router.currentRoute.value.query.paso).toBe('contar')
  })

  it('si ninguna fila sirve, no ofrece cargar y dice qué hacer', async () => {
    await cargarExcel([ENCABEZADOS, ['Cera roja', 'Limpiadores', 'L', '8.00', '', '1', '']])

    expect(pantalla!.wrapper.text()).toContain('Ninguna fila se puede cargar')
    expect(pantalla!.wrapper.findAll('button').some((b) => b.text().startsWith('Cargar'))).toBe(
      false,
    )
  })

  it('un archivo sin las columnas de la plantilla se rechaza con su mensaje', async () => {
    await cargarExcel([['nombre', 'precio']])

    expect(pantalla!.wrapper.text()).toContain(
      'El archivo no tiene la columna "categoría". Usa la plantilla',
    )
    expect(await nombresEnElCatalogo()).toEqual([])
  })
})
