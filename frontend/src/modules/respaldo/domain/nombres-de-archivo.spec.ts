import { describe, expect, it } from 'vitest'
import { instanteLocal } from '../../../shared/domain/fecha'
import { horaLocal, nombreDeArchivoCopia, nombreDeArchivoExcel, slug } from './nombres-de-archivo'

describe('slug', () => {
  it('normaliza el nombre y reemplaza espacios por guiones', () => {
    expect(slug('Bodega Rosita')).toBe('bodega-rosita')
  })

  it('quita tildes y mayúsculas', () => {
    expect(slug('Bodeguita El Niño')).toBe('bodeguita-el-nino')
  })

  it('quita caracteres fuera de [a-z0-9-]', () => {
    expect(slug('¡Bodega #1!')).toBe('bodega-1')
  })

  it('un nombre vacío da "tienda"', () => {
    expect(slug('')).toBe('tienda')
    expect(slug('   ')).toBe('tienda')
  })
})

describe('horaLocal', () => {
  it('da la hora de Lima en formato HHmm', () => {
    expect(horaLocal(instanteLocal('2026-10-15 20:30'))).toBe('2030')
  })

  it('rellena con ceros las horas y minutos de un solo dígito', () => {
    expect(horaLocal(instanteLocal('2026-10-15 05:05'))).toBe('0505')
  })
})

describe('nombres de archivo', () => {
  it('nombreDeArchivoExcel: "inventario-bodega-rosita-2026-10-15.xlsx"', () => {
    expect(nombreDeArchivoExcel('Bodega Rosita', '2026-10-15')).toBe(
      'inventario-bodega-rosita-2026-10-15.xlsx',
    )
  })

  it('nombreDeArchivoCopia: "respaldo-bodega-rosita-2026-10-15-2030.json"', () => {
    expect(nombreDeArchivoCopia('Bodega Rosita', instanteLocal('2026-10-15 20:30'))).toBe(
      'respaldo-bodega-rosita-2026-10-15-2030.json',
    )
  })
})
