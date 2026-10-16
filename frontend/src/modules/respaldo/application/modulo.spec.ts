import { describe, expect, it } from 'vitest'
import { RelojFijo } from '../../../shared/domain/reloj'
import { instanteLocal } from '../../../shared/domain/fecha'
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
import { CONFIRMACIONES_PARA_RESTAURAR, crearModuloRespaldo, type ModuloRespaldo } from './modulo'
import type { DependenciasDeRespaldo } from './puertos'

function crearModulo(): {
  modulo: ModuloRespaldo
  tienda: TiendaDePrueba
  lectorDeExcel: LectorDeExcelEnMemoria
} {
  const almacenEnMemoria = new AlmacenEnMemoria()
  const tienda = new TiendaDePrueba()
  const lectorDeExcel = new LectorDeExcelEnMemoria()
  tienda.fijarConfiguracion({ nombreTienda: 'Bodega Rosita' })

  const deps: DependenciasDeRespaldo = {
    almacen: new AlmacenDeRespaldoEnMemoria(almacenEnMemoria),
    reconstructor: new ReconstructorDePrueba(almacenEnMemoria),
    generadorDeExcel: new GeneradorDeExcelEnMemoria(),
    lectorDeExcel,
    almacenamiento: new AlmacenamientoPersistenteEnMemoria(),
    uow: new UnidadDeTrabajoEnMemoria(almacenEnMemoria),
    reloj: new RelojFijo(instanteLocal('2026-10-15 20:30')),
    catalogo: () => new CatalogoDePrueba(),
    inventario: () => new InventarioDePrueba(almacenEnMemoria),
    analisis: () => new AnalisisDePrueba(),
    tienda: () => tienda,
  }

  return { modulo: crearModuloRespaldo(deps), tienda, lectorDeExcel }
}

describe('ModuloRespaldo', () => {
  it('guardarCopia produce el archivo; marcarCopiaGuardada actualiza el estado del sistema', async () => {
    const { modulo, tienda } = crearModulo()
    const archivo = await modulo.guardarCopia()
    expect(archivo.nombre).toBe('respaldo-bodega-rosita-2026-10-15-2030.json')
    expect((await tienda.estadoDelSistema()).ultimoRespaldoEn).toBeNull()

    await modulo.marcarCopiaGuardada()
    expect((await tienda.estadoDelSistema()).ultimoRespaldoEn).not.toBeNull()
  })

  it('prepararRestauracion y restaurarCopia funcionan de punta a punta a través del módulo', async () => {
    const { modulo } = crearModulo()
    const archivo = await modulo.guardarCopia()
    const texto = await archivo.contenido.text()

    const { confirmaciones } = await modulo.prepararRestauracion(texto)
    expect(confirmaciones).toEqual(CONFIRMACIONES_PARA_RESTAURAR)

    await expect(modulo.restaurarCopia(texto, { confirmaciones: 2 })).resolves.toBeUndefined()
  })

  it('exportarExcel y descargarPlantilla delegan en los casos de uso', async () => {
    const { modulo } = crearModulo()
    const excel = await modulo.exportarExcel()
    expect(excel.nombre).toBe('inventario-bodega-rosita-2026-10-15.xlsx')

    const plantilla = await modulo.descargarPlantilla()
    expect(plantilla.hojas.map((h) => h.nombre)).toEqual(['Productos', 'Instrucciones'])
  })

  it('recordatorioDeCopia delega en el caso de uso', async () => {
    const { modulo } = crearModulo()
    expect(await modulo.recordatorioDeCopia()).toBe('Todavía no guardas una copia de tus datos')
  })

  it('solicitarAlmacenamientoSiHaceFalta delega en el caso de uso', async () => {
    const { modulo, tienda } = crearModulo()
    await modulo.solicitarAlmacenamientoSiHaceFalta()
    expect((await tienda.estadoDelSistema()).almacenamientoPersistente).not.toBe('DESCONOCIDO')
  })

  it('previsualizarImportacion y confirmarImportacion delegan en los casos de uso', async () => {
    const { modulo, lectorDeExcel } = crearModulo()
    lectorDeExcel.fijarFilas([
      [
        'nombre',
        'categoría',
        'unidad',
        'precio de compra',
        'precio de venta',
        'stock mínimo',
        'stock inicial',
      ],
    ])
    const previa = await modulo.previsualizarImportacion(new Blob())
    const resultado = await modulo.confirmarImportacion(previa)
    expect(resultado.importados).toBe(0)
  })
})
