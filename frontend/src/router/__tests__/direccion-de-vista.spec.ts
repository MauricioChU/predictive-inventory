import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { direccionDeVista, profundidadDeRuta } from '../direccion-de-vista'

const ruta = (path: string) => ({ path }) as RouteLocationNormalized

describe('dirección de la animación al cambiar de vista', () => {
  it('entre pestañas, va hacia el lado de la pestaña tocada', () => {
    expect(direccionDeVista(ruta('/recibir'), ruta('/vender'))).toBe('adelante')
    expect(direccionDeVista(ruta('/'), ruta('/control'))).toBe('atras')
    expect(direccionDeVista(ruta('/productos'), ruta('/productos'))).toBe('fundido')
  })

  it('cuenta la profundidad desde la pestaña de la que cuelga', () => {
    expect(profundidadDeRuta(ruta('/ajustes'))).toBe(1)
    expect(profundidadDeRuta(ruta('/ajustes/tienda'))).toBe(2)
    expect(profundidadDeRuta(ruta('/productos/7'))).toBe(1)
    expect(profundidadDeRuta(ruta('/productos/7/editar'))).toBe(2)
  })

  it('hacia adentro entra desde la derecha y al volver, desde la izquierda', () => {
    expect(direccionDeVista(ruta('/productos/7'), ruta('/productos'))).toBe('adelante')
    expect(direccionDeVista(ruta('/productos'), ruta('/productos/7'))).toBe('atras')
    expect(direccionDeVista(ruta('/productos/7/editar'), ruta('/productos/7'))).toBe('adelante')
    expect(direccionDeVista(ruta('/'), ruta('/ajustes/tienda'))).toBe('atras')
  })

  it('hermanas de la misma profundidad: fundido', () => {
    expect(direccionDeVista(ruta('/ajustes/copia'), ruta('/ajustes/tienda'))).toBe('fundido')
    expect(direccionDeVista(ruta('/historial'), ruta('/ajustes'))).toBe('fundido')
  })
})
