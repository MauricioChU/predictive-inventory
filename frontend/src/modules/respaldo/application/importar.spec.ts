import { describe, expect, it } from 'vitest'
import { RelojFijo } from '../../../shared/domain/reloj'
import { AlmacenEnMemoria } from '../../../shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '../../../shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { AlmacenDeRespaldoEnMemoria } from '../infrastructure/memoria/almacen-de-respaldo'
import {
  AlmacenamientoPersistenteEnMemoria,
  GeneradorDeExcelEnMemoria,
  LectorDeExcelEnMemoria,
} from '../infrastructure/memoria/dobles'
import {
  AnalisisDePrueba,
  CatalogoDePrueba,
  InventarioDePrueba,
  ReconstructorDePrueba,
  TiendaDePrueba,
} from './__pruebas__/dobles'
import { confirmarImportacion, previsualizarImportacion } from './importar'
import type { DependenciasDeRespaldo } from './puertos'

const ENCABEZADOS = [
  'nombre',
  'categoría',
  'unidad',
  'precio de compra',
  'precio de venta',
  'stock mínimo',
  'stock inicial',
]

function crearContexto() {
  const almacenEnMemoria = new AlmacenEnMemoria()
  const lectorDeExcel = new LectorDeExcelEnMemoria()
  const catalogo = new CatalogoDePrueba()

  const deps: DependenciasDeRespaldo = {
    almacen: new AlmacenDeRespaldoEnMemoria(almacenEnMemoria),
    reconstructor: new ReconstructorDePrueba(almacenEnMemoria),
    generadorDeExcel: new GeneradorDeExcelEnMemoria(),
    lectorDeExcel,
    almacenamiento: new AlmacenamientoPersistenteEnMemoria(),
    uow: new UnidadDeTrabajoEnMemoria(almacenEnMemoria),
    reloj: new RelojFijo('2026-10-15T20:30:00.000Z'),
    catalogo: () => catalogo,
    inventario: () => new InventarioDePrueba(almacenEnMemoria),
    analisis: () => new AnalisisDePrueba(),
    tienda: () => new TiendaDePrueba(),
  }

  return { deps, lectorDeExcel, catalogo }
}

describe('previsualizarImportacion (RN-RE-07)', () => {
  it('2 filas válidas y 2 con problema, incluida la del catálogo (CANTIDAD_ENTERA)', async () => {
    const { deps, lectorDeExcel } = crearContexto()
    lectorDeExcel.fijarFilas([
      ENCABEZADOS,
      ['Jabón Bolívar', 'Detergentes', 'unid', '1.20', '2.00', '5', '24'],
      ['Ambientador Glade', 'Ambientadores', 'unid', '6.50', '9.00', '2', '6'],
      ['Cera roja', 'Limpiadores', 'L', '8.00', '', '1', ''],
      ['Bolsas chicas', 'Bolsas', 'unid', '0.05', '0.10', '1.5', '100'],
    ])

    const previa = await previsualizarImportacion(deps, new Blob())

    expect(previa.validas.map((f) => f.fila)).toEqual([2, 3])
    expect(previa.conProblemas).toEqual([
      { fila: 4, problema: 'Fila 4: falta el precio de venta' },
      { fila: 5, problema: 'Fila 5: Bolsas chicas se cuenta por unidades enteras' },
    ])
  })
})

describe('previsualizarImportacion (RN-RE-08)', () => {
  it('repetidos contra el catálogo o dentro del archivo se rechazan', async () => {
    const { deps, lectorDeExcel, catalogo } = crearContexto()
    const otros = catalogo.agregarCategoria('Otros')
    catalogo.agregarProducto({ nombre: 'Lejía 1 L', categoriaId: otros, categoriaNombre: 'Otros' })

    lectorDeExcel.fijarFilas([
      ENCABEZADOS,
      ['lejia 1 l', 'Otros', 'unid', '2.40', '3.50', '3', ''],
      ['Detergente', 'Detergentes', 'kg', '5.30', '7.90', '2', '10'],
      ['detergente', 'Detergentes', 'kg', '5.30', '7.90', '2', ''],
    ])

    const previa = await previsualizarImportacion(deps, new Blob())

    expect(previa.conProblemas).toEqual([
      { fila: 2, problema: 'Fila 2: ya existe un producto llamado "Lejía 1 L"' },
      { fila: 4, problema: 'Fila 4: "detergente" está repetido en la fila 3' },
    ])
    expect(previa.validas).toHaveLength(1)
    expect(previa.validas[0]?.datos.nombre).toBe('Detergente')
  })

  it('confirmarImportacion crea la categoría nueva una sola vez y llama a crear con stockInicial', async () => {
    const { deps, lectorDeExcel, catalogo } = crearContexto()
    const otros = catalogo.agregarCategoria('Otros')
    catalogo.agregarProducto({ nombre: 'Lejía 1 L', categoriaId: otros, categoriaNombre: 'Otros' })

    lectorDeExcel.fijarFilas([
      ENCABEZADOS,
      ['lejia 1 l', 'Otros', 'unid', '2.40', '3.50', '3', ''],
      ['Detergente', 'Detergentes', 'kg', '5.30', '7.90', '2', '10'],
      ['detergente', 'Detergentes', 'kg', '5.30', '7.90', '2', ''],
    ])
    const previa = await previsualizarImportacion(deps, new Blob())

    const { importados } = await confirmarImportacion(deps, previa)

    expect(importados).toBe(1)
    expect(catalogo.categoriasCreadas).toEqual(['Detergentes'])
    expect(catalogo.llamadasACrear).toEqual([
      {
        nombre: 'Detergente',
        categoriaId: expect.any(String),
        unidad: 'KILO',
        precioCompra: '5.30',
        precioVenta: '7.90',
        stockMinimo: '2',
        stockInicial: '10',
      },
    ])
  })

  it('confirmarImportacion importa varias filas con categorías repetidas creando una sola categoría', async () => {
    const { deps, lectorDeExcel, catalogo } = crearContexto()
    lectorDeExcel.fijarFilas([
      ENCABEZADOS,
      ['Jabón Bolívar', 'Detergentes', 'unid', '1.20', '2.00', '5', '24'],
      ['Jabón Rey', 'Detergentes', 'unid', '1.10', '1.90', '5', ''],
    ])
    const previa = await previsualizarImportacion(deps, new Blob())
    expect(previa.validas).toHaveLength(2)

    const { importados } = await confirmarImportacion(deps, previa)

    expect(importados).toBe(2)
    expect(catalogo.categoriasCreadas).toEqual(['Detergentes'])
  })
})

// Ola 3, ruling 1: lo que Catálogo deja con alConfirmar (ProductoCreado, OperacionRegistrada del
// stock inicial) sale tras confirmar la importación entera, que es la unidad de trabajo externa.
describe('confirmarImportacion en una sola unidad de trabajo', () => {
  function conPublicacionAlConfirmar(contexto: ReturnType<typeof crearContexto>) {
    const { deps, catalogo } = contexto
    const publicados: string[] = []
    const crear = catalogo.importacion.crear
    // Como el Catálogo real: el evento se deja para después del commit más externo.
    catalogo.importacion.crear = async (datos) => {
      if (datos.nombre === 'Jabón Rey') throw new Error('falla al crear')
      const id = await crear(datos)
      deps.uow.alConfirmar(() => {
        publicados.push(`ProductoCreado ${datos.nombre}`)
      })
      return id
    }
    return publicados
  }

  it('RN-RE-07: si una fila falla al crearse, no se publica nada de las filas anteriores', async () => {
    const contexto = crearContexto()
    const publicados = conPublicacionAlConfirmar(contexto)
    contexto.lectorDeExcel.fijarFilas([
      ENCABEZADOS,
      ['Jabón Bolívar', 'Detergentes', 'unid', '1.20', '2.00', '5', '24'],
      ['Jabón Rey', 'Detergentes', 'unid', '1.10', '1.90', '5', ''],
    ])
    const previa = await previsualizarImportacion(contexto.deps, new Blob())

    await expect(confirmarImportacion(contexto.deps, previa)).rejects.toThrow('falla al crear')

    expect(publicados).toEqual([])
  })

  it('ADR-0002: si la importación confirma, los eventos salen después y en el orden de las filas', async () => {
    const contexto = crearContexto()
    const publicados = conPublicacionAlConfirmar(contexto)
    contexto.lectorDeExcel.fijarFilas([
      ENCABEZADOS,
      ['Jabón Bolívar', 'Detergentes', 'unid', '1.20', '2.00', '5', '24'],
      ['Ambientador Glade', 'Ambientadores', 'unid', '6.50', '9.00', '2', '6'],
    ])
    const previa = await previsualizarImportacion(contexto.deps, new Blob())

    await confirmarImportacion(contexto.deps, previa)

    expect(publicados).toEqual(['ProductoCreado Jabón Bolívar', 'ProductoCreado Ambientador Glade'])
  })
})

describe('previsualizarImportacion: otros errores del catálogo', () => {
  it('RN-RE-08: otro código usa el mensaje con la primera letra en minúscula', async () => {
    const { deps, lectorDeExcel, catalogo } = crearContexto()
    catalogo.importacion.validarNuevo = async () => ({
      codigo: 'PRECIO_INVALIDO',
      mensaje: 'El precio de venta debe ser mayor al de compra',
    })
    lectorDeExcel.fijarFilas([
      ENCABEZADOS,
      ['X', 'Otros', 'unid', '5', '1', '1', ''],
      ['Y', 'Otros', 'unid', '5', '1', '1', ''],
    ])
    const previa = await previsualizarImportacion(deps, new Blob())
    expect(previa.conProblemas[0]?.problema).toBe(
      'Fila 2: el precio de venta debe ser mayor al de compra',
    )
  })

  it('confirmarImportacion usa la categoría existente sin crearla', async () => {
    const { deps, lectorDeExcel, catalogo } = crearContexto()
    catalogo.agregarCategoria('Otros')
    lectorDeExcel.fijarFilas([ENCABEZADOS, ['X', 'Otros', 'unid', '1', '2', '1', '']])
    const previa = await previsualizarImportacion(deps, new Blob())
    await confirmarImportacion(deps, previa)
    expect(catalogo.categoriasCreadas).toEqual([])
  })
})
