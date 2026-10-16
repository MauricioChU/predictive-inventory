import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'

const HTML = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'index.html'),
  'utf8',
)

describe('index.html', () => {
  it('RN-UX-15: mientras se abren los datos, #app anuncia "Abriendo tus datos…" (Vue lo reemplaza al montar)', () => {
    const { document } = new JSDOM(HTML).window

    const aviso = document.querySelector('#app [role="status"]')

    expect(aviso?.textContent).toBe('Abriendo tus datos…')
    expect(document.querySelector('#app')?.children).toHaveLength(1)
  })
})
