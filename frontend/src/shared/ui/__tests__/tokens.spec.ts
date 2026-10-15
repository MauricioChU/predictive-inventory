// @vitest-environment node
// Nota: este archivo lee tokens.css con fs + import.meta.url. Bajo el entorno
// jsdom (por defecto en este proyecto), Vite reescribe `new URL(..., import.meta.url)`
// como una URL de assets servida por el navegador (consumer "client"), lo que rompe
// readFileSync con "The URL must be of scheme file". Forzamos entorno "node" (consumer "ssr")
// solo para este archivo, sin tocar vitest.config.ts (fuera del alcance de esta rama).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../estilos/tokens.css', import.meta.url), 'utf8')
const token = (nombre: string): string => {
  const m = css.match(new RegExp(`--${nombre}:\\s*(#[0-9a-fA-F]{6})`))
  if (!m?.[1]) throw new Error(`Falta el token --${nombre}`)
  return m[1]
}
const luminancia = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a: string, b: string): number => {
  const [l1, l2] = [luminancia(token(a)), luminancia(token(b))].sort((x, y) => y - x) as [number, number]
  return (l1 + 0.05) / (l2 + 0.05)
}

describe('RN-UX-03: contraste de los colores', () => {
  it.each([
    ['color-texto', 'color-fondo'],
    ['color-texto-suave', 'color-fondo'],
    ['color-texto', 'color-superficie'],
    ['color-primario-texto', 'color-primario'],
    ['color-primario', 'color-fondo'],
    ['color-peligro', 'color-peligro-suave'],
    ['color-advertencia', 'color-advertencia-suave'],
    ['color-exito', 'color-exito-suave'],
    ['color-primario-texto', 'color-peligro'],
  ])('%s sobre %s ≥ 7:1', (texto, fondo) => {
    expect(contraste(texto, fondo)).toBeGreaterThanOrEqual(7)
  })
  it('bordes de controles ≥ 3:1', () => {
    expect(contraste('color-borde', 'color-fondo')).toBeGreaterThanOrEqual(3)
  })
})
