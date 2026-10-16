import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AplicacionDePrueba } from '../../soporte/aplicacion-de-prueba'
import {
  crearAplicacion,
  crearProducto,
  esperar,
  montarVista,
  type VistaMontada,
} from '../../soporte/pantallas-de-productos'

function nombres(w: VueWrapper): string[] {
  return w.findAll('.fila-de-categoria .nombre').map((n) => n.text())
}

function fila(w: VueWrapper, nombre: string): DOMWrapper<Element> {
  const encontrada = w
    .findAll('.fila-de-categoria')
    .find((f) => f.find('.nombre').exists() && f.get('.nombre').text() === nombre)
  if (!encontrada) throw new Error(`No hay una fila "${nombre}"`)
  return encontrada
}

function botonEn(raiz: DOMWrapper<Element> | VueWrapper, texto: string) {
  const encontrado = raiz.findAll('button').find((b) => b.text().trim() === texto)
  if (!encontrado) throw new Error(`No hay un botón "${texto}"`)
  return encontrado
}

describe('Categorías (/productos/categorias)', () => {
  let app: AplicacionDePrueba
  let vista: VistaMontada | undefined

  beforeEach(async () => {
    app = await crearAplicacion()
  })

  afterEach(async () => {
    vista?.wrapper.unmount()
    vista = undefined
    await app.cerrar()
  })

  async function abrir() {
    vista = await montarVista(app, '/productos/categorias')
    return vista.wrapper
  }

  it('lista las categorías con "Otros" al final y cuántos productos tiene cada una', async () => {
    await crearProducto(app, {
      nombre: 'Bolsa chica',
      categoria: 'Bolsas',
      compra: '0.05',
      venta: '0.1',
    })
    const archivada = await crearProducto(app, {
      nombre: 'Bolsa grande',
      categoria: 'Bolsas',
      compra: '0.10',
      venta: '0.2',
    })
    await app.catalogo.archivarProducto({ productoId: archivada })
    await crearProducto(app, { nombre: 'Escoba', compra: '6', venta: '9' })
    const w = await abrir()
    expect(w.get('h1').text()).toBe('Categorías')
    const lista = nombres(w)
    expect(lista).toHaveLength(10)
    expect(lista.at(-1)).toBe('Otros')
    expect(lista[0]).toBe('Ambientadores e insecticidas')
    expect(fila(w, 'Bolsas').text()).toContain('2 productos')
    expect(fila(w, 'Otros').text()).toContain('1 producto')
    expect(fila(w, 'Lavavajillas').text()).toContain('Sin productos')
  })

  it('RN-CAT-15: crea una categoría y avisa que se agregó', async () => {
    const w = await abrir()
    const campo = w.get<HTMLInputElement>('form input')
    await campo.setValue('Velas')
    await botonEn(w, 'Agregar categoría').trigger('click')
    await esperar()
    expect(nombres(w)).toContain('Velas')
    expect(nombres(w).at(-1)).toBe('Otros')
    expect(w.text()).toContain('Agregaste la categoría Velas')
    expect(campo.element.value).toBe('')
  })

  it('RN-CAT-15: el nombre no se repite (sin tildes ni mayúsculas) y tiene un largo válido', async () => {
    const w = await abrir()
    const campo = w.get('form input')
    await campo.setValue('carbon y combustibles')
    await botonEn(w, 'Agregar categoría').trigger('click')
    await esperar()
    expect(w.get('form .error').text()).toBe('Ya existe una categoría con ese nombre')
    expect(nombres(w)).toHaveLength(10)

    await campo.setValue('A')
    await botonEn(w, 'Agregar categoría').trigger('click')
    await esperar()
    expect(w.get('form .error').text()).toBe(
      'El nombre de la categoría debe tener entre 2 y 40 letras',
    )
  })

  it('cambia el nombre de una categoría en su misma fila', async () => {
    const w = await abrir()
    const cambiar = botonEn(fila(w, 'Bolsas'), 'Cambiar nombre')
    expect(cambiar.attributes('aria-label')).toBe('Cambiar nombre de Bolsas')
    await cambiar.trigger('click')
    await esperar()
    // La fila pasa a ser un campo con su nombre escrito.
    const campo = w.get<HTMLInputElement>('.fila-de-categoria input')
    expect(w.get('.fila-de-categoria label').text()).toBe('Nuevo nombre para Bolsas')
    expect(campo.element.value).toBe('Bolsas')
    expect(document.activeElement).toBe(campo.element)

    await campo.setValue('Lejías y desinfectantes')
    await botonEn(w, 'Guardar nombre').trigger('click')
    await esperar()
    expect(w.get('.fila-de-categoria .error').text()).toBe('Ya existe una categoría con ese nombre')

    await w.get<HTMLInputElement>('.fila-de-categoria input').setValue('Bolsas y empaques')
    await botonEn(w, 'Guardar nombre').trigger('click')
    await esperar()
    expect(nombres(w)).toContain('Bolsas y empaques')
    expect(nombres(w)).not.toContain('Bolsas')
    expect(w.find('.fila-de-categoria input').exists()).toBe(false)
  })

  it('"Cancelar" deja el nombre como estaba', async () => {
    const w = await abrir()
    await botonEn(fila(w, 'Bolsas'), 'Cambiar nombre').trigger('click')
    await esperar()
    await w.get('.fila-de-categoria input').setValue('Otra cosa')
    await botonEn(w, 'Cancelar').trigger('click')
    await esperar()
    expect(nombres(w)).toContain('Bolsas')
    expect(document.activeElement).toBe(botonEn(fila(w, 'Bolsas'), 'Cambiar nombre').element)
  })

  it('RN-CAT-15: una categoría con productos no se elimina y lo dice en su fila', async () => {
    const escoba = await crearProducto(app, { nombre: 'Escoba', compra: '6', venta: '9' })
    await app.catalogo.archivarProducto({ productoId: escoba })
    const w = await abrir()
    await botonEn(fila(w, 'Otros'), 'Eliminar').trigger('click')
    await esperar()
    expect(fila(w, 'Otros').get('[role="alert"]').text()).toContain(
      'La categoría tiene productos. Puedes cambiarle el nombre',
    )
    expect(nombres(w)).toContain('Otros')
  })

  it('una categoría vacía se elimina sin preguntar y ofrece Deshacer', async () => {
    const w = await abrir()
    const eliminar = botonEn(fila(w, 'Lavavajillas'), 'Eliminar')
    expect(eliminar.attributes('aria-label')).toBe('Eliminar Lavavajillas')
    await eliminar.trigger('click')
    await esperar()
    expect(nombres(w)).not.toContain('Lavavajillas')
    expect(vista!.aviso.activo.value?.mensaje).toBe('Eliminaste la categoría Lavavajillas')

    vista!.aviso.activo.value?.alDeshacer()
    await esperar()
    expect(nombres(w)).toContain('Lavavajillas')
  })
})
