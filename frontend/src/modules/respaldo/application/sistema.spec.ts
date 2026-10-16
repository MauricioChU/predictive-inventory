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
import { recordatorioDeCopia, solicitarAlmacenamientoSiHaceFalta } from './sistema'
import type { DependenciasDeRespaldo } from './puertos'

function crearContexto() {
  const almacenEnMemoria = new AlmacenEnMemoria()
  const tienda = new TiendaDePrueba()
  const almacenamiento = new AlmacenamientoPersistenteEnMemoria()

  const reloj = new RelojFijo(instanteLocal('2026-10-15 20:30'))
  const deps: DependenciasDeRespaldo = {
    almacen: new AlmacenDeRespaldoEnMemoria(almacenEnMemoria),
    reconstructor: new ReconstructorDePrueba(almacenEnMemoria),
    generadorDeExcel: new GeneradorDeExcelEnMemoria(),
    lectorDeExcel: new LectorDeExcelEnMemoria(),
    almacenamiento,
    uow: new UnidadDeTrabajoEnMemoria(almacenEnMemoria),
    reloj,
    catalogo: () => new CatalogoDePrueba(),
    inventario: () => new InventarioDePrueba(almacenEnMemoria),
    analisis: () => new AnalisisDePrueba(),
    tienda: () => tienda,
  }

  return { deps, tienda, almacenamiento, reloj }
}

describe('recordatorioDeCopia (RN-RE-06/09)', () => {
  it('nunca hubo copia', async () => {
    const { deps } = crearContexto()
    expect(await recordatorioDeCopia(deps)).toBe('Todavía no guardas una copia de tus datos')
  })

  it('hace 7 días (concedido) muestra el recordatorio', async () => {
    const { deps, tienda } = crearContexto()
    tienda.fijarEstado({
      ultimoRespaldoEn: '2026-10-08T05:00:00.000Z',
      almacenamientoPersistente: 'CONCEDIDO',
    })
    expect(await recordatorioDeCopia(deps)).toBe('Hace 7 días que no guardas una copia')
  })

  it('hace 6 días no muestra recordatorio', async () => {
    const { deps, tienda } = crearContexto()
    tienda.fijarEstado({
      ultimoRespaldoEn: '2026-10-09T05:00:00.000Z',
      almacenamientoPersistente: 'CONCEDIDO',
    })
    expect(await recordatorioDeCopia(deps)).toBeNull()
  })

  it('RN-RE-09: rechazado y 3 días muestra el recordatorio', async () => {
    const { deps, tienda } = crearContexto()
    tienda.fijarEstado({
      ultimoRespaldoEn: '2026-10-12T05:00:00.000Z',
      almacenamientoPersistente: 'RECHAZADO',
    })
    expect(await recordatorioDeCopia(deps)).toBe('Hace 3 días que no guardas una copia')
  })
})

describe('recordatorioDeCopia: día de Lima', () => {
  it('2026-10-16T03:00Z es el 15/10 en Lima: una copia del 9/10 (Lima) lleva 6 días, sin aviso', async () => {
    const { deps, tienda, reloj } = crearContexto()
    reloj.fijar('2026-10-16T03:00:00.000Z')
    tienda.fijarEstado({
      ultimoRespaldoEn: '2026-10-09T10:00:00.000Z',
      almacenamientoPersistente: 'CONCEDIDO',
    })
    expect(await recordatorioDeCopia(deps)).toBeNull()
  })

  it('la misma copia un día antes (8/10 en Lima, 2026-10-09T03:00Z) sí avisa: 7 días', async () => {
    const { deps, tienda, reloj } = crearContexto()
    reloj.fijar('2026-10-16T03:00:00.000Z')
    tienda.fijarEstado({
      ultimoRespaldoEn: '2026-10-09T03:00:00.000Z',
      almacenamientoPersistente: 'CONCEDIDO',
    })
    expect(await recordatorioDeCopia(deps)).toBe('Hace 7 días que no guardas una copia')
  })
})

describe('solicitarAlmacenamientoSiHaceFalta (RN-RE-09)', () => {
  it('DESCONOCIDO: se solicita y se guarda el resultado', async () => {
    const { deps, tienda, almacenamiento } = crearContexto()
    almacenamiento.fijarResultado(true)

    await solicitarAlmacenamientoSiHaceFalta(deps)

    const estado = await tienda.estadoDelSistema()
    expect(estado.almacenamientoPersistente).toBe('CONCEDIDO')
  })

  it('DESCONOCIDO y rechazado: se guarda RECHAZADO', async () => {
    const { deps, tienda, almacenamiento } = crearContexto()
    almacenamiento.fijarResultado(false)

    await solicitarAlmacenamientoSiHaceFalta(deps)

    expect((await tienda.estadoDelSistema()).almacenamientoPersistente).toBe('RECHAZADO')
  })

  it('ya CONCEDIDO: no se vuelve a pedir', async () => {
    const { deps, tienda, almacenamiento } = crearContexto()
    tienda.fijarEstado({ almacenamientoPersistente: 'CONCEDIDO' })
    let preguntado = false
    almacenamiento.solicitar = async () => {
      preguntado = true
      return false
    }

    await solicitarAlmacenamientoSiHaceFalta(deps)

    expect(preguntado).toBe(false)
    expect((await tienda.estadoDelSistema()).almacenamientoPersistente).toBe('CONCEDIDO')
  })
})
