// @vitest-environment node
// (Lee archivos con fs + import.meta.url: ver la nota de tokens.spec.ts sobre el entorno.)
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const COMPONENTES_DEL_KIT_A = [
  'FotoDeProducto',
  'TarjetaDeProducto',
  'BuscadorGrande',
  'ListaDeProductos',
  'AccesosRapidos',
  'FilaDeCarrito',
  'BarraDeTotal',
  'SelectorDeBilletes',
  'CampoFoto',
]
const leer = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), 'utf8')

describe('ronda 1: colores del kit A sin color-mix()', () => {
  // Con var() adentro, un Chrome < 111 no descarta la declaración al leerla: la invalida al
  // calcularla y el color pasa a currentcolor (un borde negro, una sombra negra).
  it.each(COMPONENTES_DEL_KIT_A)('%s usa tokens, no color-mix()', (nombre) => {
    expect(leer(`../componentes/${nombre}.vue`)).not.toMatch(/color-mix\(/)
  })

  it('tokens.css define el borde de las fotos y la sombra de lo que flota', () => {
    const tokens = leer('../estilos/tokens.css')
    expect(tokens).toMatch(/--color-borde-foto:\s*rgb\(/)
    expect(tokens).toMatch(/--sombra-flotante:\s*0 /)
  })
})
