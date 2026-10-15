# Plan 02 — UI base: diseño, componentes, navegación y pruebas E2E

> **Para agentes:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (o executing-plans). Pasos `- [ ]`. Leer [00-plan-maestro.md](00-plan-maestro.md). Para decisiones visuales, cargar también la skill `anthropic-skills:frontend-design-pro`.

**Objetivo:** la "piel" de la app, lista para que las olas siguientes solo agreguen pantallas: tokens de diseño accesibles, tamaño de letra configurable, componentes base, navegación responsive y Playwright con verificaciones de responsive y accesibilidad.

**Rama:** `feat/ui-base`. Comandos en `frontend/`.

**Spec:** [06-experiencia-de-uso.md](../../specs/fase-1/06-experiencia-de-uso.md) (RN-UX-01 a RN-UX-15), [03-alertas.md](../../specs/fase-1/03-alertas.md) (RN-AL-05), [07-calidad.md](../../specs/fase-1/07-calidad.md) (RN-SIS-05 a RN-SIS-07), [ADR-0007](../../adr/0007-hosting-github-pages.md).

**No tocar:** `src/shared/domain/**`, `src/shared/contratos/**`, `src/shared/application/**`, `tsconfig*.json`, `vitest.config.ts`, `eslint.config.ts`, `scripts/**`, `tests/**` (los cambia `feat/fundamentos`). Esta rama **sí** puede borrar `src/stores/counter.ts` y `src/__tests__/App.spec.ts`.

**Dónde van los tests de componentes:** `src/**/__tests__/*.spec.ts` (es lo que incluye hoy `tsconfig.vitest.json`).

## Estructura

```
frontend/src/
├─ main.ts                                  importa estilos, aplica letra guardada, monta
├─ App.vue                                  <LayoutApp />
├─ router/index.ts                          rutas con meta (título, ícono, navegación)
├─ app/
│  ├─ LayoutApp.vue                         navegación + <RouterView> + aviso deshacer global
│  └─ vistas/PendienteVista.vue             pantalla provisional por ruta
└─ shared/ui/
   ├─ estilos/tokens.css                    colores, espacios, tipografía (RN-UX-01..03)
   ├─ estilos/base.css                      reset, foco visible, movimiento reducido
   ├─ preferencias/tamano-de-letra.ts       aplicar/leer tamaño (data-letra + localStorage)
   ├─ presentacion-estado.ts                AGOTADO / POR_ACABARSE / NORMAL → color + ícono + texto
   └─ componentes/
      ├─ BotonPrincipal.vue  Boton.vue  CampoTexto.vue  CampoNumero.vue
      ├─ Tarjeta.vue  InsigniaEstado.vue  EstadoVacio.vue  EncabezadoPagina.vue
      ├─ AvisoDeshacer.vue  DialogoConfirmacion.vue  PantallaExito.vue
      ├─ GraficoBarras.vue
      └─ BarraNavegacion.vue
frontend/e2e/
├─ utilidades/calidad.ts                    sin scroll horizontal, axe, letra
└─ navegacion.spec.ts
```

---

### Tarea 1: Tokens de diseño, estilos base y tamaño de letra

**Archivos:** crear `src/shared/ui/estilos/tokens.css`, `src/shared/ui/estilos/base.css`, `src/shared/ui/preferencias/tamano-de-letra.ts`, `src/shared/ui/__tests__/tokens.spec.ts`, `src/shared/ui/__tests__/tamano-de-letra.spec.ts`; modificar `src/main.ts`.

**Produce:** variables CSS `--color-*`, `--espacio-*`, `--radio*`, `--alto-toque`, `--alto-boton-principal`; `type TamanoDeLetra = 'NORMAL' | 'GRANDE' | 'MUY_GRANDE'`; `aplicarTamanoDeLetra(t)`, `leerTamanoDeLetraGuardado(): TamanoDeLetra`.

- [ ] **Paso 1: test de contraste que falla** — `src/shared/ui/__tests__/tokens.spec.ts`

```ts
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
```

- [ ] **Paso 2:** `npx vitest run src/shared/ui` → FAIL.

- [ ] **Paso 3: tokens** — `src/shared/ui/estilos/tokens.css` (ajustar los hex hasta que el test pase; estos son el punto de partida)

```css
:root {
  --color-fondo: #ffffff;
  --color-superficie: #f3f5f4;
  --color-texto: #121a18;
  --color-texto-suave: #37433f;
  --color-borde: #66756f;
  --color-primario: #0a524c;
  --color-primario-texto: #ffffff;
  --color-primario-suave: #e2f0ee;
  --color-peligro: #8f1c16;
  --color-peligro-suave: #fdeceb;
  --color-advertencia: #6b3a00;
  --color-advertencia-suave: #fff2df;
  --color-exito: #17502d;
  --color-exito-suave: #e5f3e9;
  --color-foco: #1946c4;

  --fuente: 'Atkinson Hyperlegible', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --espacio-1: 0.25rem;
  --espacio-2: 0.5rem;
  --espacio-3: 0.75rem;
  --espacio-4: 1rem;
  --espacio-5: 1.5rem;
  --espacio-6: 2rem;
  --radio: 14px;
  --radio-chico: 10px;
  /* Medidas táctiles absolutas: no bajan aunque la letra sea Normal (RN-UX-02). */
  --alto-toque: max(48px, 2.5rem);
  --alto-boton-principal: max(56px, 3rem);
  --separacion-toque: 8px;
  --ancho-contenido: 720px;
  --ancho-contenido-pc: 1200px;
}

/* RN-UX-01: la base escala todo el diseño (rem). */
html { font-size: 20px; }
html[data-letra='NORMAL'] { font-size: 18px; }
html[data-letra='GRANDE'] { font-size: 20px; }
html[data-letra='MUY_GRANDE'] { font-size: 24px; }
```

`src/shared/ui/estilos/base.css`
```css
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  min-height: 100dvh;
  background: var(--color-fondo);
  color: var(--color-texto);
  font-family: var(--fuente);
  line-height: 1.45;
  overflow-wrap: anywhere; /* RN-UX-09: nombres largos no empujan el ancho */
}
img, svg { max-width: 100%; display: block; }
button, input, select, textarea { font: inherit; color: inherit; }
:focus-visible { outline: 3px solid var(--color-foco); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
.solo-lector {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
```
Fuente: cargar *Atkinson Hyperlegible* (diseñada para baja visión) con `@fontsource/atkinson-hyperlegible` (`npm i @fontsource/atkinson-hyperlegible`, importar los pesos 400 y 700 en `main.ts`); así queda dentro de la app y funciona sin internet.

- [ ] **Paso 4: test que falla del tamaño de letra** — `src/shared/ui/__tests__/tamano-de-letra.spec.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { aplicarTamanoDeLetra, leerTamanoDeLetraGuardado } from '../preferencias/tamano-de-letra'

describe('RN-UX-01: tamaño de letra', () => {
  beforeEach(() => localStorage.clear())
  it('por defecto es Grande', () => {
    expect(leerTamanoDeLetraGuardado()).toBe('GRANDE')
  })
  it('aplica el tamaño al documento y lo recuerda', () => {
    aplicarTamanoDeLetra('MUY_GRANDE')
    expect(document.documentElement.dataset.letra).toBe('MUY_GRANDE')
    expect(leerTamanoDeLetraGuardado()).toBe('MUY_GRANDE')
  })
  it('ignora valores guardados inválidos', () => {
    localStorage.setItem('pi.letra', 'ENORME')
    expect(leerTamanoDeLetraGuardado()).toBe('GRANDE')
  })
})
```

- [ ] **Paso 5: implementación** — `src/shared/ui/preferencias/tamano-de-letra.ts`

```ts
export type TamanoDeLetra = 'NORMAL' | 'GRANDE' | 'MUY_GRANDE'
const CLAVE = 'pi.letra'
const VALIDOS: readonly TamanoDeLetra[] = ['NORMAL', 'GRANDE', 'MUY_GRANDE']

/** Copia rápida en localStorage para aplicar la letra antes de abrir la base de datos (evita parpadeo). La fuente de verdad será la configuración de la tienda. */
export function leerTamanoDeLetraGuardado(): TamanoDeLetra {
  try {
    const valor = localStorage.getItem(CLAVE)
    return VALIDOS.includes(valor as TamanoDeLetra) ? (valor as TamanoDeLetra) : 'GRANDE'
  } catch {
    return 'GRANDE'
  }
}

export function aplicarTamanoDeLetra(tamano: TamanoDeLetra): void {
  document.documentElement.dataset.letra = tamano
  try {
    localStorage.setItem(CLAVE, tamano)
  } catch {
    /* almacenamiento bloqueado: se aplica solo en esta sesión */
  }
}
```

`src/main.ts`
```ts
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import './shared/ui/estilos/tokens.css'
import './shared/ui/estilos/base.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { aplicarTamanoDeLetra, leerTamanoDeLetraGuardado } from './shared/ui/preferencias/tamano-de-letra'

aplicarTamanoDeLetra(leerTamanoDeLetraGuardado())

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

- [ ] **Paso 6:** `npx vitest run src/shared/ui` → PASS. Commit `feat(ui): tokens accesibles y tamaño de letra configurable`.

---

### Tarea 2: Botones y campos

**Archivos:** crear `BotonPrincipal.vue`, `Boton.vue`, `CampoTexto.vue`, `CampoNumero.vue` en `src/shared/ui/componentes/` y `src/shared/ui/__tests__/botones-y-campos.spec.ts`; instalar `lucide-vue-next`.

**Produce (props/eventos):**
- `BotonPrincipal`: props `{ texto: string; icono?: Component; variante?: 'primario' | 'secundario' | 'peligro'; deshabilitado?: boolean; tipo?: 'button' | 'submit' }`, emite `click`. Alto ≥ `--alto-boton-principal`, ancho 100 % en celular.
- `Boton`: igual, pero alto `--alto-toque` y ancho automático.
- `CampoTexto`: props `{ etiqueta: string; modelValue: string; error?: string; ayuda?: string; tipo?: string; autocompletar?: string }`, `v-model`. Etiqueta siempre visible; error con `aria-describedby` y `aria-invalid`.
- `CampoNumero`: props `{ etiqueta: string; modelValue: string; paso?: number; minimo?: number; decimales?: boolean; error?: string; sufijo?: string }`, `v-model` de **texto** (el dominio valida). Botones `−` y `+` de 48 px con `aria-label` "Quitar uno" / "Agregar uno"; `inputmode="decimal"` o `"numeric"`; acepta coma (RN-UX-06).

- [ ] **Paso 1:** `npm i lucide-vue-next`. Revisar en `node_modules/lucide-vue-next` los nombres exportados de la versión 1.x (por ejemplo `Plus`, `Minus`, `House`, `ShoppingCart`, `PackagePlus`, `Package`, `Gauge`, `Settings`, `CircleX`, `TriangleAlert`, `CircleCheck`, `ArrowLeft`, `Undo2`) y usar los que existan.

- [ ] **Paso 2: tests que fallan**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BotonPrincipal from '../componentes/BotonPrincipal.vue'
import CampoNumero from '../componentes/CampoNumero.vue'
import CampoTexto from '../componentes/CampoTexto.vue'

describe('BotonPrincipal', () => {
  it('RN-UX-04: muestra el texto aunque tenga ícono, y emite click', async () => {
    const w = mount(BotonPrincipal, { props: { texto: 'Vender' } })
    expect(w.text()).toContain('Vender')
    await w.trigger('click')
    expect(w.emitted('click')).toHaveLength(1)
  })
  it('no emite click deshabilitado', async () => {
    const w = mount(BotonPrincipal, { props: { texto: 'Cobrar', deshabilitado: true } })
    await w.trigger('click')
    expect(w.emitted('click')).toBeUndefined()
  })
})

describe('CampoTexto', () => {
  it('asocia etiqueta y error al input (RN-UX-15)', () => {
    const w = mount(CampoTexto, { props: { etiqueta: 'Nombre', modelValue: '', error: 'Escribe el nombre del producto' } })
    const input = w.get('input')
    expect(w.get('label').attributes('for')).toBe(input.attributes('id'))
    expect(input.attributes('aria-invalid')).toBe('true')
    const idError = input.attributes('aria-describedby')!
    expect(w.get(`#${idError}`).text()).toBe('Escribe el nombre del producto')
  })
})

describe('CampoNumero (RN-UX-06)', () => {
  it('suma y resta con los botones grandes', async () => {
    const w = mount(CampoNumero, { props: { etiqueta: 'Cantidad', modelValue: '2' } })
    await w.get('[aria-label="Agregar uno"]').trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['3'])
    await w.setProps({ modelValue: '3' })
    await w.get('[aria-label="Quitar uno"]').trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['2'])
  })
  it('no baja del mínimo', async () => {
    const w = mount(CampoNumero, { props: { etiqueta: 'Cantidad', modelValue: '0', minimo: 0 } })
    await w.get('[aria-label="Quitar uno"]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
  it('acepta coma decimal y abre el teclado numérico', async () => {
    const w = mount(CampoNumero, { props: { etiqueta: 'Kilos', modelValue: '1,5', decimales: true } })
    expect(w.get('input').attributes('inputmode')).toBe('decimal')
    await w.get('[aria-label="Agregar uno"]').trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['2.5'])
  })
})
```

- [ ] **Paso 3:** FAIL.

- [ ] **Paso 4: implementación de referencia**

`CampoNumero.vue`
```vue
<script setup lang="ts">
import { computed, useId } from 'vue'
import { Minus, Plus } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{ etiqueta: string; modelValue: string; paso?: number; minimo?: number; decimales?: boolean; error?: string; sufijo?: string }>(),
  { paso: 1, minimo: 0, decimales: false, error: undefined, sufijo: undefined },
)
const emit = defineEmits<{ 'update:modelValue': [valor: string] }>()
const id = useId()
const valorNumerico = computed(() => Number(props.modelValue.replace(',', '.')) || 0)

function cambiar(delta: number) {
  const siguiente = Math.round((valorNumerico.value + delta) * 1000) / 1000
  if (siguiente < props.minimo) return
  emit('update:modelValue', String(siguiente))
}
</script>

<template>
  <div class="campo-numero">
    <label :for="id" class="etiqueta">{{ etiqueta }}</label>
    <div class="fila">
      <button type="button" class="paso" aria-label="Quitar uno" @click="cambiar(-paso)"><Minus aria-hidden="true" /></button>
      <input
        :id="id"
        :value="modelValue"
        :inputmode="decimales ? 'decimal' : 'numeric'"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? `${id}-error` : undefined"
        autocomplete="off"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <span v-if="sufijo" class="sufijo">{{ sufijo }}</span>
      <button type="button" class="paso" aria-label="Agregar uno" @click="cambiar(paso)"><Plus aria-hidden="true" /></button>
    </div>
    <p v-if="error" :id="`${id}-error`" class="error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.etiqueta { display: block; font-weight: 700; margin-bottom: var(--espacio-2); }
.fila { display: flex; align-items: stretch; gap: var(--separacion-toque); }
input {
  flex: 1; min-width: 0; min-height: var(--alto-toque); text-align: center; font-size: 1.25rem;
  border: 2px solid var(--color-borde); border-radius: var(--radio-chico); background: var(--color-fondo);
}
.paso {
  inline-size: var(--alto-toque); block-size: var(--alto-toque); flex: none; display: grid; place-items: center;
  border: 2px solid var(--color-primario); border-radius: var(--radio-chico);
  background: var(--color-primario-suave); color: var(--color-primario); cursor: pointer;
}
.sufijo { align-self: center; font-weight: 700; }
.error { color: var(--color-peligro); font-weight: 700; margin: var(--espacio-2) 0 0; }
</style>
```
`BotonPrincipal.vue`, `Boton.vue` y `CampoTexto.vue` siguen el mismo patrón: `useId()` para ids, ícono con `aria-hidden="true"`, texto siempre visible, `disabled` real en el `<button>`.

- [ ] **Paso 5:** PASS. Commit `feat(ui): botones y campos grandes y accesibles`.

---

### Tarea 3: Tarjetas, estado de stock, vacíos, encabezado y éxito

**Archivos:** crear `Tarjeta.vue`, `InsigniaEstado.vue`, `EstadoVacio.vue`, `EncabezadoPagina.vue`, `PantallaExito.vue`, `src/shared/ui/presentacion-estado.ts` y `src/shared/ui/__tests__/presentacion.spec.ts`.

**Produce:**
```ts
type EstadoVisual = 'AGOTADO' | 'POR_ACABARSE' | 'NORMAL'   // mismo literal que EstadoDeStock de los contratos
const PRESENTACION_DE_ESTADO: Record<EstadoVisual, { texto: string; color: 'rojo' | 'naranja' | 'verde'; icono: 'círculo-x' | 'advertencia' | 'check'; claseCss: string }>
```
- `InsigniaEstado`: prop `estado: EstadoVisual`; muestra ícono + texto con color de fondo suave.
- `EstadoVacio`: props `{ titulo: string; descripcion?: string; accion?: string }`, emite `accion` (RN-UX-10).
- `EncabezadoPagina`: props `{ titulo: string; volver?: boolean }`; botón "Volver" visible de 48 px (`router.back()` o `emit('volver')`).
- `PantallaExito`: props `{ titulo: string; detalle?: string }`, ícono ✓ grande, `role="status"` (RN-UX-11).

- [ ] **Paso 1: test que falla**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { PRESENTACION_DE_ESTADO } from '../presentacion-estado'
import InsigniaEstado from '../componentes/InsigniaEstado.vue'
import EstadoVacio from '../componentes/EstadoVacio.vue'

describe('RN-AL-05: cada estado con color, ícono y texto', () => {
  it.each([
    ['AGOTADO', 'rojo', 'círculo-x', 'Agotado'],
    ['POR_ACABARSE', 'naranja', 'advertencia', 'Queda poco'],
    ['NORMAL', 'verde', 'check', 'Bien'],
  ] as const)('%s', (estado, color, icono, texto) => {
    expect(PRESENTACION_DE_ESTADO[estado]).toMatchObject({ color, icono, texto })
    const w = mount(InsigniaEstado, { props: { estado } })
    expect(w.text()).toContain(texto)
    expect(w.find('svg').exists()).toBe(true)
  })
})

describe('RN-UX-10: estado vacío útil', () => {
  it('explica y ofrece la acción siguiente', async () => {
    const w = mount(EstadoVacio, { props: { titulo: 'Aún no tienes productos.', accion: 'Agregar el primero' } })
    await w.get('button').trigger('click')
    expect(w.emitted('accion')).toHaveLength(1)
  })
})
```

- [ ] **Paso 2:** FAIL. **Paso 3:** implementar. **Paso 4:** PASS.
- [ ] **Paso 5:** commit `feat(ui): tarjetas, insignia de estado, vacíos y pantalla de éxito`.

---

### Tarea 4: Deshacer, diálogo de confirmación y gráfico de barras

**Archivos:** crear `AvisoDeshacer.vue`, `DialogoConfirmacion.vue`, `GraficoBarras.vue` y `src/shared/ui/__tests__/interaccion.spec.ts`.

**Produce:**
- `AvisoDeshacer`: props `{ mensaje: string; segundos?: number (10) }`, emite `deshacer` y `cerrar`. Muestra la cuenta regresiva; `aria-live="polite"`; se cierra solo al llegar a 0 (RN-OP-18).
- `DialogoConfirmacion`: props `{ abierto: boolean; titulo: string; mensaje: string; textoConfirmar: string; textoCancelar?: string ('Cancelar'); peligro?: boolean }`, emite `confirmar` / `cancelar`. Usa `<dialog>` con `showModal()`; foco inicial en "Cancelar"; `Escape` cancela (RN-UX-08).
- `GraficoBarras`: props `{ barras: { etiqueta: string; valor: number; textoValor: string; destacada?: boolean }[]; titulo: string }`. SVG con `role="img"` y `aria-label` que resume los datos, más una tabla `.solo-lector` con los valores (RN-AN-13, RN-AN-14). Seguir la skill `dataviz` para colores y etiquetas.

- [ ] **Paso 1: test que falla**

```ts
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AvisoDeshacer from '../componentes/AvisoDeshacer.vue'
import GraficoBarras from '../componentes/GraficoBarras.vue'

describe('RN-OP-18: aviso Deshacer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  it('ofrece deshacer y se cierra solo a los 10 segundos', async () => {
    const w = mount(AvisoDeshacer, { props: { mensaje: 'Venta registrada' } })
    expect(w.text()).toContain('Deshacer')
    await vi.advanceTimersByTimeAsync(5000)
    await w.get('button').trigger('click')
    expect(w.emitted('deshacer')).toHaveLength(1)
  })
  it('emite cerrar al terminar el tiempo', async () => {
    const w = mount(AvisoDeshacer, { props: { mensaje: 'Venta registrada', segundos: 10 } })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(w.emitted('cerrar')).toHaveLength(1)
  })
})

describe('GraficoBarras', () => {
  it('es legible por lector de pantalla', () => {
    const w = mount(GraficoBarras, {
      props: { titulo: 'Ventas por día', barras: [{ etiqueta: 'lun', valor: 100, textoValor: 'S/ 100.00' }, { etiqueta: 'sáb', valor: 200, textoValor: 'S/ 200.00', destacada: true }] },
    })
    expect(w.get('svg').attributes('role')).toBe('img')
    expect(w.get('table').text()).toContain('S/ 200.00')
  })
})
```

- [ ] **Paso 2:** FAIL. **Paso 3:** implementar. **Paso 4:** PASS.
- [ ] **Paso 5:** commit `feat(ui): deshacer, confirmación accesible y gráfico de barras`.

---

### Tarea 5: Navegación, layout y rutas

**Archivos:** crear `src/shared/ui/componentes/BarraNavegacion.vue`, `src/app/LayoutApp.vue`, `src/app/vistas/PendienteVista.vue`, `src/shared/ui/__tests__/navegacion.spec.ts`; modificar `src/App.vue`, `src/router/index.ts`; borrar `src/stores/counter.ts` y `src/__tests__/App.spec.ts`.

**Produce:** rutas con nombre y `meta: { titulo: string; enNavegacion?: boolean; icono?: string }`:

| Nombre | Ruta | Título | En navegación |
|---|---|---|---|
| `inicio` | `/` | Inicio | sí |
| `vender` | `/vender` | Vender | sí |
| `recibir` | `/recibir` | Recibir | sí |
| `productos` | `/productos` | Productos | sí |
| `control` | `/control` | Control | sí |
| `historial` | `/historial` | Historial | no |
| `ajustes` | `/ajustes` | Ajustes | no |

Todas cargan `PendienteVista` (muestra el título y "Esta pantalla se construye en la próxima etapa") con `component: () => import(...)`. `BarraNavegacion` recibe prop opcional `contadorControl?: number` y lo muestra como insignia en *Control* con texto accesible "N productos necesitan atención".

- [ ] **Paso 1: test que falla**

```ts
import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { rutas } from '@/router'
import BarraNavegacion from '../componentes/BarraNavegacion.vue'

describe('RN-UX-12: navegación fija con 5 destinos', () => {
  it('muestra Inicio, Vender, Recibir, Productos y Control con texto', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: rutas })
    await router.push('/')
    const w = mount(BarraNavegacion, { global: { plugins: [router] } })
    await flushPromises()
    expect(w.findAll('a').map((a) => a.text().trim())).toEqual(['Inicio', 'Vender', 'Recibir', 'Productos', 'Control'])
    expect(w.get('a[aria-current="page"]').text()).toContain('Inicio')
  })
  it('muestra el contador de atención en Control', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: rutas })
    const w = mount(BarraNavegacion, { props: { contadorControl: 2 }, global: { plugins: [router] } })
    expect(w.text()).toContain('2')
    expect(w.text()).toContain('2 productos necesitan atención')
  })
})
```

- [ ] **Paso 2:** FAIL.

- [ ] **Paso 3: implementación**

`src/router/index.ts`
```ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const Pendiente = () => import('@/app/vistas/PendienteVista.vue')

export const rutas: RouteRecordRaw[] = [
  { path: '/', name: 'inicio', component: Pendiente, meta: { titulo: 'Inicio', enNavegacion: true } },
  { path: '/vender', name: 'vender', component: Pendiente, meta: { titulo: 'Vender', enNavegacion: true } },
  { path: '/recibir', name: 'recibir', component: Pendiente, meta: { titulo: 'Recibir', enNavegacion: true } },
  { path: '/productos', name: 'productos', component: Pendiente, meta: { titulo: 'Productos', enNavegacion: true } },
  { path: '/control', name: 'control', component: Pendiente, meta: { titulo: 'Control', enNavegacion: true } },
  { path: '/historial', name: 'historial', component: Pendiente, meta: { titulo: 'Historial' } },
  { path: '/ajustes', name: 'ajustes', component: Pendiente, meta: { titulo: 'Ajustes' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({ history: createWebHistory(import.meta.env.BASE_URL), routes: rutas })

router.afterEach((to) => {
  document.title = `${String(to.meta.titulo ?? 'Inventario')} · Inventario`
})

export default router
```
Declarar el tipo de `meta` en `env.d.ts`:
```ts
import 'vue-router'
declare module 'vue-router' {
  interface RouteMeta { titulo?: string; enNavegacion?: boolean }
}
```

`LayoutApp.vue`: grid con `<BarraNavegacion>` abajo (posición fija, `padding-bottom: env(safe-area-inset-bottom)`) por debajo de 1024 px y columna lateral desde 1024 px; `<main id="contenido">` con `max-width: var(--ancho-contenido)` (y `--ancho-contenido-pc` desde 1024 px), `padding-inline: var(--espacio-4)` y espacio inferior para que la barra no tape el contenido. Enlace "Saltar al contenido" al inicio (RN-UX-15).

`App.vue`
```vue
<script setup lang="ts">
import LayoutApp from './app/LayoutApp.vue'
</script>

<template>
  <LayoutApp />
</template>
```

- [ ] **Paso 4:** PASS. `npm run type-check` → PASS.
- [ ] **Paso 5:** commit `feat(ui): navegación responsive con cinco destinos y rutas base`.

---

### Tarea 6: Base pública para GitHub Pages

**Archivos:** modificar `vite.config.ts`.

- [ ] **Paso 1:** en `defineConfig`, agregar `base: '/predictive-inventory/'` y en el manifest del PWA usar rutas relativas: `start_url: './'`, `scope: './'`, e `id: '/predictive-inventory/'`. En `VitePWA` agregar `workbox: { navigateFallback: 'index.html' }`.
- [ ] **Paso 2:** `npm run build-only` → `dist/manifest.webmanifest` contiene `"start_url":"./"` y `dist/index.html` referencia `/predictive-inventory/assets/...`.
- [ ] **Paso 3:** `npm run dev` y abrir `http://localhost:5173/predictive-inventory/` → se ve la navegación. Detener el servidor.
- [ ] **Paso 4:** commit `build: base /predictive-inventory/ para GitHub Pages (ADR-0007)`.

---

### Tarea 7: Playwright con celular y PC, responsive y accesibilidad

**Archivos:** modificar `playwright.config.ts`; crear `e2e/utilidades/calidad.ts`, `e2e/navegacion.spec.ts`; borrar `e2e/vue.spec.ts`; instalar `@axe-core/playwright`.

- [ ] **Paso 1:** `npm i -D @axe-core/playwright` y `npx playwright install chromium`.

- [ ] **Paso 2: `playwright.config.ts`** — solo Chromium (Android usa Chrome), dos proyectos:

```ts
import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const BASE = process.env.CI ? 'http://localhost:4173/predictive-inventory/' : 'http://localhost:5173/predictive-inventory/'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: BASE, trace: 'on-first-retry', locale: 'es-PE', timezoneId: 'America/Lima' },
  projects: [
    { name: 'celular', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 740 } } },
    { name: 'pc', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: process.env.CI ? 'npm run preview' : 'npm run dev',
    url: BASE,
    reuseExistingServer: !process.env.CI,
  },
})
```

- [ ] **Paso 3: utilidades** — `e2e/utilidades/calidad.ts`

```ts
import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

export type Letra = 'NORMAL' | 'GRANDE' | 'MUY_GRANDE'

/** Debe llamarse antes de page.goto: fija el tamaño de letra guardado. */
export async function usarLetra(page: Page, letra: Letra): Promise<void> {
  await page.addInitScript((valor) => localStorage.setItem('pi.letra', valor), letra)
}

/** RN-UX-09 / RN-SIS-06 */
export async function esperarSinDesplazamientoHorizontal(page: Page): Promise<void> {
  const { scroll, cliente } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    cliente: document.documentElement.clientWidth,
  }))
  expect(scroll, 'la página no debe desplazarse a los lados').toBeLessThanOrEqual(cliente)
}

/** RN-SIS-07 */
export async function esperarSinViolacionesGraves(page: Page): Promise<void> {
  const resultado = await new AxeBuilder({ page }).analyze()
  const graves = resultado.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(graves.map((v) => `${v.id}: ${v.help}`)).toEqual([])
}
```

- [ ] **Paso 4: test E2E** — `e2e/navegacion.spec.ts`

```ts
import { expect, test } from '@playwright/test'
import { esperarSinDesplazamientoHorizontal, esperarSinViolacionesGraves, usarLetra } from './utilidades/calidad'

const DESTINOS = ['Inicio', 'Vender', 'Recibir', 'Productos', 'Control']
const ANCHOS = [320, 360, 768, 1280]

test.describe('RN-UX-12: navegación', () => {
  test('los cinco destinos están visibles y funcionan', async ({ page }) => {
    await page.goto('./')
    for (const destino of DESTINOS) {
      await page.getByRole('link', { name: destino }).click()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(destino)
    }
  })
})

test.describe('RN-SIS-06 y RN-SIS-07: responsive y accesibilidad', () => {
  for (const ancho of ANCHOS) {
    test(`sin desplazamiento horizontal a ${ancho}px con letra Muy grande`, async ({ page }) => {
      await usarLetra(page, 'MUY_GRANDE')
      await page.setViewportSize({ width: ancho, height: 800 })
      for (const ruta of ['./', './vender', './recibir', './productos', './control', './ajustes', './historial']) {
        await page.goto(ruta)
        await esperarSinDesplazamientoHorizontal(page)
        await expect(page.getByRole('navigation')).toBeVisible()
      }
    })
  }
  test('sin violaciones graves de accesibilidad', async ({ page }) => {
    await page.goto('./')
    await esperarSinViolacionesGraves(page)
  })
})
```

- [ ] **Paso 5:** `npx playwright test` → PASS en `celular` y `pc`.
- [ ] **Paso 6:** `npm run lint && npm run type-check && npx vitest run && npm run build-only` → PASS.
- [ ] **Paso 7:** commit `test(e2e): Playwright en celular y PC con verificación responsive y de accesibilidad`.
