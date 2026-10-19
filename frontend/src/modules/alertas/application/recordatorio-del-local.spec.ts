import { describe, expect, it } from 'vitest'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { crearContextoDePrueba } from '../__pruebas__/dobles'
import { recordatorioVigenteDelLocal } from './recordatorio-del-local'

// 2026-10-18 10:00 en Lima
const DIA_18 = '2026-10-18T15:00:00.000Z'

function prepararContexto(ahora = DIA_18) {
  const almacen = new AlmacenEnMemoria()
  const contexto = crearContextoDePrueba(new UnidadDeTrabajoEnMemoria(almacen), almacen, ahora)
  contexto.tiendaFalsa.configuracionActual = {
    ...contexto.tiendaFalsa.configuracionActual,
    alquilerDelLocal: { tipo: 'MENSUAL', montoCentimos: 120000, dias: [20] },
  }
  return contexto
}

describe('recordatorioVigenteDelLocal (RN-AL-10)', () => {
  it('RN-AL-10: dentro de la ventana devuelve la frase', async () => {
    const { dependencias } = prepararContexto()

    expect(await recordatorioVigenteDelLocal(dependencias)).toEqual({
      fechaDePago: '2026-10-20',
      texto: 'Pasado mañana pagas el local: S/ 1 200.00',
    })
  })

  it('RN-AL-10: sin pago configurado devuelve null', async () => {
    const { dependencias, tiendaFalsa } = prepararContexto()
    tiendaFalsa.configuracionActual = { ...tiendaFalsa.configuracionActual, alquilerDelLocal: null }

    expect(await recordatorioVigenteDelLocal(dependencias)).toBeNull()
  })

  it('RN-AL-10: mañana y hoy dicen su frase; fuera de la ventana no hay', async () => {
    const { dependencias, reloj } = prepararContexto()

    reloj.fijar('2026-10-19T15:00:00.000Z')
    expect((await recordatorioVigenteDelLocal(dependencias))?.texto).toBe(
      'Mañana pagas el local: S/ 1 200.00',
    )
    reloj.fijar('2026-10-20T15:00:00.000Z')
    expect((await recordatorioVigenteDelLocal(dependencias))?.texto).toBe(
      'Hoy pagas el local: S/ 1 200.00',
    )
    reloj.fijar('2026-10-17T15:00:00.000Z')
    expect(await recordatorioVigenteDelLocal(dependencias)).toBeNull()
  })
})
