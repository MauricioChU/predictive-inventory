import { describe, expect, it } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'
import { History, House, Settings } from 'lucide-vue-next'
import { rutas } from '@/router'
import { iconoDeRuta } from '../iconos-de-rutas'

function todas(lista: readonly RouteRecordRaw[]): RouteRecordRaw[] {
  return lista.flatMap((r) => [r, ...todas(r.children ?? [])])
}

describe('plan 17: íconos de las rutas', () => {
  it('cada ícono que declara una ruta (meta.icono) tiene su dibujo', () => {
    const sinDibujo = todas(rutas)
      .map((r) => r.meta?.icono)
      .filter((icono): icono is string => typeof icono === 'string')
      .filter((icono) => iconoDeRuta(icono) === undefined)
    expect(sinDibujo).toEqual([])
  })

  it('Historial y Ajustes tienen el suyo (no caen en la casita de Inicio)', () => {
    expect(iconoDeRuta('history')).toBe(History)
    expect(iconoDeRuta('settings')).toBe(Settings)
    expect(iconoDeRuta('house')).toBe(House)
  })

  it('un nombre desconocido no tiene dibujo', () => {
    expect(iconoDeRuta('no-existe')).toBeUndefined()
  })
})
