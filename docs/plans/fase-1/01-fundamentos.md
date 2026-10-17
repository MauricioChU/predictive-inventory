# Plan 01 — Fundamentos: dominio compartido, contratos y specs ejecutables

> **Para agentes:** REQUIRED SUB-SKILL: usar superpowers:subagent-driven-development (o superpowers:executing-plans). Pasos con casillas `- [ ]`. Leer antes [00-plan-maestro.md](00-plan-maestro.md) (restricciones globales).

**Objetivo:** dejar listo todo lo que los módulos necesitan para trabajar en paralelo: objetos de valor compartidos (`Dinero`, `Cantidad`, fechas), errores, eventos, unidad de trabajo, **contratos entre módulos**, el runner de Gherkin y la verificación de specs.

**Rama:** `feat/fundamentos` (worktree propio, sale de `develop`). Todos los comandos se corren en `frontend/`.

**Spec:** [ADR-0003](../../adr/0003-enteros-para-dinero-y-cantidades.md), [ADR-0005](../../adr/0005-arquitectura-hexagonal-modular.md), [ADR-0006](../../adr/0006-specs-ejecutables.md), [07-calidad.md](../../specs/fase-1/07-calidad.md) (RN-SIS-01 a RN-SIS-04).

**No tocar:** `src/App.vue`, `src/main.ts`, `src/router/**`, `src/stores/**`, `src/__tests__/**`, `vite.config.ts`, `playwright.config.ts`, `e2e/**` (los cambia la rama `feat/ui-base`).

## Estructura de archivos

```
frontend/
├─ scripts/verificar-specs.mjs              RN-SIS-01
├─ tests/gherkin/
│  ├─ registro-de-pasos.ts                  definición y búsqueda de pasos
│  ├─ ejecutar-feature.ts                   parsea .feature → describe/it de Vitest
│  ├─ registro-de-pasos.spec.ts
│  ├─ ejecutar-feature.spec.ts
│  └─ __fixtures__/ejemplo.feature
├─ tests/aceptacion/<feature>.feature.spec.ts   (5 archivos, con registro vacío por ahora)
└─ src/shared/
   ├─ domain/
   │  ├─ errores.ts          ErrorDeDominio
   │  ├─ texto.ts            normalizar()
   │  ├─ dinero.ts           Dinero (céntimos)
   │  ├─ cantidad.ts         Cantidad (milésimas), Unidad
   │  ├─ formato.ts          formatearDinero, formatearCantidad, …
   │  ├─ fecha.ts            Instante, Dia, aritmética de días (America/Lima)
   │  ├─ reloj.ts            puerto Reloj + RelojFijo
   │  ├─ ids.ts              puerto GeneradorDeIds + implementaciones
   │  └─ eventos.ts          EventoDeDominio, BusDeEventos, BusEnMemoria
   ├─ application/
   │  ├─ respuesta.ts        Respuesta<T> (hecho / confirmar / reactivar)
   │  └─ unidad-de-trabajo.ts  puerto UnidadDeTrabajo
   ├─ contratos/
   │  ├─ estado-de-stock.ts
   │  ├─ operaciones.ts      TipoDeOperacion, MotivoDeMerma
   │  ├─ configuracion.ts
   │  ├─ registros.ts        formas persistidas (Dexie, memoria, respaldo)
   │  └─ entre-modulos.ts    puertos y DTO que un módulo ofrece a otros
   └─ infrastructure/memoria/
      ├─ almacen-en-memoria.ts
      └─ unidad-de-trabajo-en-memoria.ts
```

---

### Tarea 1: Configuración de pruebas, cobertura y fronteras de arquitectura

**Archivos:**
- Modificar: `frontend/package.json` (scripts y dependencias de desarrollo)
- Modificar: `frontend/tsconfig.app.json`, `frontend/tsconfig.vitest.json`, `frontend/vitest.config.ts`, `frontend/eslint.config.ts`
- Modificar: `docs/adr/0003-enteros-para-dinero-y-cantidades.md` (consecuencia sobre el formato)

- [ ] **Paso 1: Instalar dependencias de desarrollo**

```bash
npm install -D @cucumber/gherkin@^42 @cucumber/messages@^34 @cucumber/cucumber-expressions@^20 @vitest/coverage-v8@^4
```
(`@vitest/coverage-v8` debe coincidir con la versión mayor de `vitest`, que es 4.)

- [ ] **Paso 2: Scripts en `package.json`** (agregar o reemplazar estas claves dentro de `"scripts"`)

```json
"test:unit": "vitest",
"test:cobertura": "vitest run --coverage",
"lint:ci": "oxlint . && eslint . --max-warnings 0 && prettier --check --experimental-cli src/ tests/",
"verificar-specs": "node scripts/verificar-specs.mjs"
```
Además, en `"format"`, incluir también `tests/`: `"format": "prettier --write --experimental-cli src/ tests/"`.

- [ ] **Paso 3: tsconfig**

`tsconfig.app.json` → `"exclude": ["src/**/__tests__/*", "src/**/*.spec.ts"]`.

`tsconfig.vitest.json` → `"include": ["src/**/__tests__/*", "src/**/*.spec.ts", "tests/**/*.ts", "env.d.ts"]`.

- [ ] **Paso 4: `vitest.config.ts`**

```ts
import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.spec.ts', 'src/**/__tests__/*.spec.ts', 'tests/**/*.spec.ts'],
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.spec.ts', 'src/**/ui/**', 'src/app/**', 'src/main.ts', 'src/router/**'],
        thresholds: {
          'src/**/domain/**': { lines: 95, branches: 95, functions: 95, statements: 95 },
          'src/**/application/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
        },
      },
    },
  }),
)
```

- [ ] **Paso 5: reglas de arquitectura en `eslint.config.ts`**

Agregar estos objetos dentro de `defineConfigWithVueTs(...)`, **antes** de `skipFormatting`:

```ts
  {
    name: 'arquitectura/importar-modulos-por-index',
    files: ['src/**/*.{ts,vue}', 'tests/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@/modules/*/*', '@/modules/*/*/**'],
          message: 'Importa otros módulos solo por su index (@/modules/<modulo>). Dentro del módulo usa rutas relativas (ADR-0005).',
        }],
      }],
    },
  },
  {
    name: 'arquitectura/dominio-puro',
    files: ['src/shared/domain/**/*.ts', 'src/modules/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['vue', 'vue-router', 'pinia', 'dexie', '@vueuse/*', 'lucide-vue-next'], message: 'El dominio es TypeScript puro (ADR-0005).' },
          { group: ['**/application/**', '**/infrastructure/**', '**/ui/**', '@/app/**', '@/modules/**'], message: 'El dominio no depende de otras capas ni de otros módulos (ADR-0005).' },
        ],
      }],
    },
  },
  {
    name: 'arquitectura/aplicacion-sin-infraestructura',
    files: ['src/shared/application/**/*.ts', 'src/modules/*/application/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['vue', 'vue-router', 'pinia', 'dexie', '@vueuse/*'], message: 'Los casos de uso no dependen de frameworks (ADR-0005).' },
          { group: ['**/infrastructure/**', '**/ui/**', '@/app/**', '@/modules/*/*', '@/modules/*/*/**'], message: 'Los casos de uso solo usan dominio y puertos (ADR-0005).' },
        ],
      }],
    },
  },
  {
    name: 'calidad/sin-any',
    files: ['src/**/*.{ts,vue}', 'tests/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
```
Y ampliar el bloque de Vitest para que cubra los nuevos tests: `files: ['src/**/__tests__/*', 'src/**/*.spec.ts', 'tests/**/*.spec.ts']`.

- [ ] **Paso 6: verificar que la frontera funciona**

Crear temporalmente `src/shared/domain/__prueba_frontera.ts` con `import { ref } from 'vue'; export const x = ref(1)`.
Run: `npx eslint src/shared/domain/__prueba_frontera.ts`
Expected: error `no-restricted-imports` con "El dominio es TypeScript puro". **Borrar el archivo.**

- [ ] **Paso 7: ADR-0003**: reemplazar la línea "⚠️ La conversión a texto (`S/ 3.50`, `1.25 kg`) se hace solo en la capa de UI." por:
"⚠️ La conversión a texto (`S/ 3.50`, `1.25 kg`) se centraliza en `shared/domain/formato.ts`, porque los mensajes de las reglas de negocio la necesitan; ningún otro archivo formatea montos ni cantidades."

- [ ] **Paso 8: verificar y commit**

Run: `npm run type-check && npx vitest run && npm run lint:ci`
Expected: todo en verde (el test de ejemplo `src/__tests__/App.spec.ts` sigue pasando).

```bash
git add -A && git commit -m "chore(frontend): configuración de pruebas, cobertura y fronteras de arquitectura"
```

---

### Tarea 2: Errores, texto normalizado y respuesta de casos de uso

**Archivos:** crear `src/shared/domain/errores.ts`, `src/shared/domain/texto.ts`, `src/shared/domain/texto.spec.ts`, `src/shared/application/respuesta.ts`.

**Produce:** `ErrorDeDominio(codigo, mensaje)`, `normalizar(texto)`, `Respuesta<T>`, `hecho()`, `confirmar()`, `ofrecerReactivar()`.

- [ ] **Paso 1: test que falla** — `src/shared/domain/texto.spec.ts`

```ts
import { describe, expect, it } from 'vitest'
import { normalizar } from './texto'

describe('normalizar', () => {
  it('RN-CAT-01: ignora mayúsculas, tildes y espacios repetidos', () => {
    expect(normalizar('  LEJÍA   1 L ')).toBe('lejia 1 l')
    expect(normalizar('Lejía  1L')).toBe(normalizar('lejia 1l'))
    expect(normalizar('Carbón')).toBe('carbon')
  })
  it('conserva la ñ como n sin tilde', () => {
    expect(normalizar('Piña')).toBe('pina')
  })
})
```

- [ ] **Paso 2:** `npx vitest run src/shared/domain/texto.spec.ts` → FAIL (módulo no existe).

- [ ] **Paso 3: implementación**

`src/shared/domain/texto.ts`
```ts
/** Forma comparable de un texto: sin tildes, en minúsculas y con espacios simples (RN-CAT-01). */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}
```

`src/shared/domain/errores.ts`
```ts
/** Violación de una regla de negocio. `mensaje` es el texto exacto que ve el usuario (spec). */
export class ErrorDeDominio extends Error {
  constructor(
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje)
    this.name = 'ErrorDeDominio'
  }
}

export function esErrorDeDominio(error: unknown): error is ErrorDeDominio {
  return error instanceof ErrorDeDominio
}
```

`src/shared/application/respuesta.ts`
```ts
/**
 * Resultado de un caso de uso que puede necesitar una decisión del usuario.
 * Las violaciones de reglas se lanzan como ErrorDeDominio, no viajan aquí.
 */
export type Respuesta<T> =
  | { tipo: 'hecho'; valor: T }
  | { tipo: 'confirmar'; mensaje: string }
  | { tipo: 'reactivar'; productoId: string; nombre: string }

export const hecho = <T>(valor: T): Respuesta<T> => ({ tipo: 'hecho', valor })
export const confirmar = <T = never>(mensaje: string): Respuesta<T> => ({ tipo: 'confirmar', mensaje })
export const ofrecerReactivar = <T = never>(productoId: string, nombre: string): Respuesta<T> => ({
  tipo: 'reactivar',
  productoId,
  nombre,
})
```

- [ ] **Paso 4:** `npx vitest run src/shared/domain/texto.spec.ts` → PASS.
- [ ] **Paso 5:** `git add -A && git commit -m "feat(shared): errores de dominio, texto normalizado y respuesta de casos de uso"`

---

### Tarea 3: `Dinero`

**Archivos:** crear `src/shared/domain/dinero.ts`, `src/shared/domain/dinero.spec.ts`. (Depende de `Cantidad` solo como tipo: crear primero `cantidad.ts` de la Tarea 4 si se prefiere; o hacer las Tareas 3 y 4 juntas.)

**Produce:**
```ts
class Dinero {
  readonly centimos: number
  static deCentimos(c: number): Dinero; static cero(): Dinero; static deTexto(t: string): Dinero
  sumar(o: Dinero): Dinero; restar(o: Dinero): Dinero; negar(): Dinero
  multiplicarPor(c: Cantidad): Dinero
  esCero(): boolean; esNegativo(): boolean; esPositivo(): boolean
  compararCon(o: Dinero): number; igualA(o): boolean; mayorQue(o): boolean; menorQue(o): boolean; menorOIgualQue(o): boolean
  static sumarTodos(lista: Dinero[]): Dinero
}
function redondearMitadLejosDeCero(numerador: number, divisor: number): number
```

- [ ] **Paso 1: test que falla** — `src/shared/domain/dinero.spec.ts`

```ts
import { describe, expect, it } from 'vitest'
import { Dinero, redondearMitadLejosDeCero } from './dinero'
import { Cantidad } from './cantidad'

describe('Dinero', () => {
  it('se construye desde texto con punto, coma o símbolo', () => {
    expect(Dinero.deTexto('2.40').centimos).toBe(240)
    expect(Dinero.deTexto('2,40').centimos).toBe(240)
    expect(Dinero.deTexto('S/ 3.5').centimos).toBe(350)
    expect(Dinero.deTexto('0').centimos).toBe(0)
    expect(Dinero.deTexto('-1.00').centimos).toBe(-100)
    expect(Dinero.deTexto('99999.99').centimos).toBe(9_999_999)
  })
  it('RN-CAT-04: rechaza más de dos decimales', () => {
    expect(() => Dinero.deTexto('2.405')).toThrow('Usa como máximo dos decimales')
  })
  it('rechaza texto que no es un monto', () => {
    expect(() => Dinero.deTexto('')).toThrow('Escribe un monto válido, por ejemplo 3.50')
    expect(() => Dinero.deTexto('abc')).toThrow('Escribe un monto válido, por ejemplo 3.50')
  })
  it('suma, resta y compara', () => {
    const a = Dinero.deCentimos(350)
    const b = Dinero.deCentimos(240)
    expect(a.sumar(b).centimos).toBe(590)
    expect(a.restar(b).centimos).toBe(110)
    expect(b.restar(a).esNegativo()).toBe(true)
    expect(a.mayorQue(b)).toBe(true)
    expect(b.menorOIgualQue(a)).toBe(true)
    expect(Dinero.sumarTodos([a, b, a]).centimos).toBe(940)
  })
  it('RN-OP-12: multiplica por cantidad redondeando al céntimo, mitad hacia arriba', () => {
    expect(Dinero.deTexto('2.75').multiplicarPor(Cantidad.deMilesimas(1250)).centimos).toBe(344) // 3.4375
    expect(Dinero.deTexto('7.90').multiplicarPor(Cantidad.deMilesimas(333)).centimos).toBe(263) // 2.6307
    expect(Dinero.deTexto('5.30').multiplicarPor(Cantidad.deMilesimas(333)).centimos).toBe(176) // 1.7649
    expect(Dinero.deTexto('2.75').multiplicarPor(Cantidad.deMilesimas(1500)).centimos).toBe(413) // 4.125
  })
  it('redondea valores negativos alejándose de cero', () => {
    expect(Dinero.deTexto('2.75').multiplicarPor(Cantidad.deMilesimas(-500)).centimos).toBe(-138) // -1.375
    expect(redondearMitadLejosDeCero(-1375, 1000)).toBe(-1)
    expect(redondearMitadLejosDeCero(1500, 1000)).toBe(2)
  })
  it('exige céntimos enteros', () => {
    expect(() => Dinero.deCentimos(1.5)).toThrow()
  })
})
```

- [ ] **Paso 2:** `npx vitest run src/shared/domain/dinero.spec.ts` → FAIL.

- [ ] **Paso 3: implementación** — `src/shared/domain/dinero.ts`

```ts
import type { Cantidad } from './cantidad'
import { ErrorDeDominio } from './errores'

const PATRON_NUMERO = /^-?\d+(\.\d+)?$/

/** Redondea numerador/divisor al entero más cercano; las mitades se alejan de cero. */
export function redondearMitadLejosDeCero(numerador: number, divisor: number): number {
  const signo = numerador < 0 ? -1 : 1
  return signo * Math.floor((Math.abs(numerador) + divisor / 2) / divisor)
}

/** Monto en soles, guardado como céntimos enteros (ADR-0003). */
export class Dinero {
  private constructor(readonly centimos: number) {}

  static deCentimos(centimos: number): Dinero {
    if (!Number.isSafeInteger(centimos)) throw new Error(`Céntimos inválidos: ${centimos}`)
    return new Dinero(centimos)
  }

  static cero(): Dinero {
    return new Dinero(0)
  }

  /** Acepta "2.40", "2,40", "S/ 2.40". Lanza ErrorDeDominio con el mensaje de la spec. */
  static deTexto(texto: string): Dinero {
    const limpio = texto.replace(/S\/\s*/i, '').replace(/\s+/g, '').replace(',', '.')
    if (!PATRON_NUMERO.test(limpio)) {
      throw new ErrorDeDominio('DINERO_INVALIDO', 'Escribe un monto válido, por ejemplo 3.50')
    }
    const negativo = limpio.startsWith('-')
    const [entero = '0', decimales = ''] = limpio.replace('-', '').split('.')
    if (decimales.length > 2) {
      throw new ErrorDeDominio('DINERO_DECIMALES', 'Usa como máximo dos decimales')
    }
    const centimos = Number(entero) * 100 + Number(decimales.padEnd(2, '0'))
    return Dinero.deCentimos(negativo ? -centimos : centimos)
  }

  static sumarTodos(lista: readonly Dinero[]): Dinero {
    return lista.reduce((total, d) => total.sumar(d), Dinero.cero())
  }

  sumar(otro: Dinero): Dinero {
    return Dinero.deCentimos(this.centimos + otro.centimos)
  }

  restar(otro: Dinero): Dinero {
    return Dinero.deCentimos(this.centimos - otro.centimos)
  }

  negar(): Dinero {
    return Dinero.deCentimos(-this.centimos)
  }

  /** Precio por unidad × cantidad, redondeado al céntimo (RN-OP-12). */
  multiplicarPor(cantidad: Cantidad): Dinero {
    return Dinero.deCentimos(redondearMitadLejosDeCero(this.centimos * cantidad.milesimas, 1000))
  }

  esCero(): boolean {
    return this.centimos === 0
  }

  esNegativo(): boolean {
    return this.centimos < 0
  }

  esPositivo(): boolean {
    return this.centimos > 0
  }

  compararCon(otro: Dinero): number {
    return this.centimos - otro.centimos
  }

  igualA(otro: Dinero): boolean {
    return this.centimos === otro.centimos
  }

  mayorQue(otro: Dinero): boolean {
    return this.centimos > otro.centimos
  }

  menorQue(otro: Dinero): boolean {
    return this.centimos < otro.centimos
  }

  menorOIgualQue(otro: Dinero): boolean {
    return this.centimos <= otro.centimos
  }
}
```

- [ ] **Paso 4:** `npx vitest run src/shared/domain/dinero.spec.ts` → PASS.
- [ ] **Paso 5:** commit `feat(shared): Dinero en céntimos con redondeo por línea`.

---

### Tarea 4: `Cantidad` y `Unidad`

**Archivos:** crear `src/shared/domain/cantidad.ts`, `src/shared/domain/cantidad.spec.ts`.

**Produce:**
```ts
type Unidad = 'UNIDAD' | 'KILO' | 'LITRO'
const UNIDADES: readonly Unidad[]
class Cantidad {
  readonly milesimas: number
  static deMilesimas(m: number): Cantidad; static cero(): Cantidad; static deEntero(n: number): Cantidad
  static deTexto(texto: string, unidad: Unidad): Cantidad   // valida precisión según unidad
  static incrementoDe(unidad: Unidad): Cantidad              // 1 (UNIDAD) o 0.5 (KILO, LITRO)
  sumar, restar, negar, abs
  esCero, esPositiva, esNegativa, esUno
  compararCon, igualA, mayorQue, menorQue, mayorOIgualQue, menorOIgualQue
  esValidaPara(unidad: Unidad): boolean
  redondearHaciaArribaA(incremento: Cantidad): Cantidad
  static sumarTodas(lista: Cantidad[]): Cantidad
}
```

- [ ] **Paso 1: test que falla** — `src/shared/domain/cantidad.spec.ts`

```ts
import { describe, expect, it } from 'vitest'
import { Cantidad } from './cantidad'

describe('Cantidad', () => {
  it('se construye desde texto en milésimas', () => {
    expect(Cantidad.deTexto('2', 'UNIDAD').milesimas).toBe(2000)
    expect(Cantidad.deTexto('1.25', 'KILO').milesimas).toBe(1250)
    expect(Cantidad.deTexto('0,125', 'KILO').milesimas).toBe(125)
    expect(Cantidad.deTexto('3.0', 'UNIDAD').milesimas).toBe(3000)
    expect(Cantidad.deTexto('-2', 'UNIDAD').milesimas).toBe(-2000)
  })
  it('RN-OP-04: UNIDAD solo acepta enteros', () => {
    expect(() => Cantidad.deTexto('1.5', 'UNIDAD')).toThrow('Este producto se cuenta por unidades enteras')
  })
  it('RN-OP-04: KILO y LITRO aceptan hasta tres decimales', () => {
    expect(() => Cantidad.deTexto('0.0005', 'KILO')).toThrow('Usa como máximo tres decimales')
    expect(Cantidad.deTexto('0.333', 'LITRO').milesimas).toBe(333)
  })
  it('rechaza texto que no es una cantidad', () => {
    expect(() => Cantidad.deTexto('', 'KILO')).toThrow('Escribe una cantidad válida, por ejemplo 2 o 1.5')
    expect(() => Cantidad.deTexto('dos', 'UNIDAD')).toThrow('Escribe una cantidad válida, por ejemplo 2 o 1.5')
  })
  it('opera y compara', () => {
    const a = Cantidad.deEntero(10)
    const b = Cantidad.deMilesimas(2500)
    expect(a.restar(b).milesimas).toBe(7500)
    expect(b.restar(a).esNegativa()).toBe(true)
    expect(b.negar().abs().igualA(b)).toBe(true)
    expect(Cantidad.deEntero(1).esUno()).toBe(true)
    expect(Cantidad.sumarTodas([a, b]).milesimas).toBe(12500)
  })
  it('valida precisión de valores ya construidos', () => {
    expect(Cantidad.deMilesimas(1500).esValidaPara('UNIDAD')).toBe(false)
    expect(Cantidad.deMilesimas(1500).esValidaPara('KILO')).toBe(true)
  })
  it('RN-AN-06: redondea hacia arriba al incremento de la unidad', () => {
    expect(Cantidad.incrementoDe('UNIDAD').milesimas).toBe(1000)
    expect(Cantidad.incrementoDe('LITRO').milesimas).toBe(500)
    expect(Cantidad.deMilesimas(1250).redondearHaciaArribaA(Cantidad.incrementoDe('KILO')).milesimas).toBe(1500)
    expect(Cantidad.deMilesimas(10200).redondearHaciaArribaA(Cantidad.incrementoDe('UNIDAD')).milesimas).toBe(11000)
    expect(Cantidad.deMilesimas(1000).redondearHaciaArribaA(Cantidad.incrementoDe('UNIDAD')).milesimas).toBe(1000)
  })
})
```

- [ ] **Paso 2:** `npx vitest run src/shared/domain/cantidad.spec.ts` → FAIL.

- [ ] **Paso 3: implementación** — `src/shared/domain/cantidad.ts`

```ts
import { ErrorDeDominio } from './errores'

export type Unidad = 'UNIDAD' | 'KILO' | 'LITRO'
export const UNIDADES: readonly Unidad[] = ['UNIDAD', 'KILO', 'LITRO']

const PATRON_NUMERO = /^-?\d+(\.\d+)?$/

/** Cantidad en milésimas de la unidad del producto (ADR-0003). */
export class Cantidad {
  private constructor(readonly milesimas: number) {}

  static deMilesimas(milesimas: number): Cantidad {
    if (!Number.isSafeInteger(milesimas)) throw new Error(`Milésimas inválidas: ${milesimas}`)
    return new Cantidad(milesimas)
  }

  static cero(): Cantidad {
    return new Cantidad(0)
  }

  static deEntero(n: number): Cantidad {
    return Cantidad.deMilesimas(n * 1000)
  }

  /** Lee lo que escribe el usuario y valida la precisión de la unidad (RN-OP-04). El signo lo valida quien la usa. */
  static deTexto(texto: string, unidad: Unidad): Cantidad {
    const limpio = texto.trim().replace(',', '.')
    if (!PATRON_NUMERO.test(limpio)) {
      throw new ErrorDeDominio('CANTIDAD_INVALIDA', 'Escribe una cantidad válida, por ejemplo 2 o 1.5')
    }
    const negativo = limpio.startsWith('-')
    const [entero = '0', crudos = ''] = limpio.replace('-', '').split('.')
    const decimales = crudos.replace(/0+$/, '')
    if (unidad === 'UNIDAD' && decimales.length > 0) {
      throw new ErrorDeDominio('CANTIDAD_ENTERA', 'Este producto se cuenta por unidades enteras')
    }
    if (decimales.length > 3) {
      throw new ErrorDeDominio('CANTIDAD_DECIMALES', 'Usa como máximo tres decimales')
    }
    const milesimas = Number(entero) * 1000 + Number(decimales.padEnd(3, '0'))
    return Cantidad.deMilesimas(negativo ? -milesimas : milesimas)
  }

  /** Paso mínimo para cantidades sugeridas: 1 unidad, o 0.5 kg / 0.5 L (RN-AN-06). */
  static incrementoDe(unidad: Unidad): Cantidad {
    return Cantidad.deMilesimas(unidad === 'UNIDAD' ? 1000 : 500)
  }

  static sumarTodas(lista: readonly Cantidad[]): Cantidad {
    return lista.reduce((total, c) => total.sumar(c), Cantidad.cero())
  }

  sumar(otra: Cantidad): Cantidad {
    return Cantidad.deMilesimas(this.milesimas + otra.milesimas)
  }

  restar(otra: Cantidad): Cantidad {
    return Cantidad.deMilesimas(this.milesimas - otra.milesimas)
  }

  negar(): Cantidad {
    return Cantidad.deMilesimas(-this.milesimas)
  }

  abs(): Cantidad {
    return Cantidad.deMilesimas(Math.abs(this.milesimas))
  }

  esCero(): boolean {
    return this.milesimas === 0
  }

  esPositiva(): boolean {
    return this.milesimas > 0
  }

  esNegativa(): boolean {
    return this.milesimas < 0
  }

  esUno(): boolean {
    return this.milesimas === 1000
  }

  compararCon(otra: Cantidad): number {
    return this.milesimas - otra.milesimas
  }

  igualA(otra: Cantidad): boolean {
    return this.milesimas === otra.milesimas
  }

  mayorQue(otra: Cantidad): boolean {
    return this.milesimas > otra.milesimas
  }

  menorQue(otra: Cantidad): boolean {
    return this.milesimas < otra.milesimas
  }

  mayorOIgualQue(otra: Cantidad): boolean {
    return this.milesimas >= otra.milesimas
  }

  menorOIgualQue(otra: Cantidad): boolean {
    return this.milesimas <= otra.milesimas
  }

  esValidaPara(unidad: Unidad): boolean {
    return unidad !== 'UNIDAD' || this.milesimas % 1000 === 0
  }

  /** Para valores ≥ 0: el menor múltiplo del incremento que no es menor que esta cantidad. */
  redondearHaciaArribaA(incremento: Cantidad): Cantidad {
    const paso = incremento.milesimas
    return Cantidad.deMilesimas(Math.ceil(this.milesimas / paso) * paso)
  }
}
```

- [ ] **Paso 4:** `npx vitest run src/shared/domain/` → PASS (cantidad y dinero).
- [ ] **Paso 5:** commit `feat(shared): Cantidad en milésimas con precisión por unidad`.

---

### Tarea 5: Formato de montos, cantidades y fechas

**Archivos:** crear `src/shared/domain/formato.ts`, `src/shared/domain/formato.spec.ts`.

**Produce:** `SIMBOLO_DE_UNIDAD`, `formatearDinero(d)`, `formatearNumero(c)`, `formatearCantidad(c, u)`, `formatearEntero(n)`, `formatearDia(dia)`, `plural(n, singular, plural)`.

- [ ] **Paso 1: test que falla**

```ts
import { describe, expect, it } from 'vitest'
import { Cantidad } from './cantidad'
import { Dinero } from './dinero'
import { formatearCantidad, formatearDia, formatearDinero, formatearEntero, formatearNumero, plural } from './formato'

describe('formato', () => {
  it('formatea soles con dos decimales y signo', () => {
    expect(formatearDinero(Dinero.deCentimos(1463))).toBe('S/ 14.63')
    expect(formatearDinero(Dinero.deCentimos(5))).toBe('S/ 0.05')
    expect(formatearDinero(Dinero.deCentimos(-480))).toBe('-S/ 4.80')
    expect(formatearDinero(Dinero.deCentimos(125000))).toBe('S/ 1,250.00')
  })
  it('formatea cantidades sin ceros sobrantes y con su unidad', () => {
    expect(formatearNumero(Cantidad.deMilesimas(1250))).toBe('1.25')
    expect(formatearNumero(Cantidad.deMilesimas(-2000))).toBe('-2')
    expect(formatearCantidad(Cantidad.deEntero(3), 'UNIDAD')).toBe('3 unid.')
    expect(formatearCantidad(Cantidad.deMilesimas(1500), 'KILO')).toBe('1.5 kg')
    expect(formatearCantidad(Cantidad.deEntero(2), 'LITRO')).toBe('2 L')
  })
  it('agrupa miles con espacio en conteos', () => {
    expect(formatearEntero(3840)).toBe('3 840')
    expect(formatearEntero(152)).toBe('152')
  })
  it('formatea días como DD/MM/AAAA', () => {
    expect(formatearDia('2026-10-15')).toBe('15/10/2026')
  })
  it('elige singular o plural', () => {
    expect(plural(1, 'producto', 'productos')).toBe('producto')
    expect(plural(3, 'producto', 'productos')).toBe('productos')
  })
})
```

- [ ] **Paso 2:** ejecutar → FAIL.

- [ ] **Paso 3: implementación**

```ts
import type { Cantidad, Unidad } from './cantidad'
import type { Dinero } from './dinero'
import type { Dia } from './fecha'

export const SIMBOLO_DE_UNIDAD: Record<Unidad, string> = { UNIDAD: 'unid.', KILO: 'kg', LITRO: 'L' }

function agrupar(entero: number, separador: string): string {
  return String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, separador)
}

export function formatearDinero(dinero: Dinero): string {
  const absoluto = Math.abs(dinero.centimos)
  const texto = `S/ ${agrupar(Math.floor(absoluto / 100), ',')}.${String(absoluto % 100).padStart(2, '0')}`
  return dinero.centimos < 0 ? `-${texto}` : texto
}

export function formatearNumero(cantidad: Cantidad): string {
  const absoluto = Math.abs(cantidad.milesimas)
  const entero = Math.floor(absoluto / 1000)
  const decimales = String(absoluto % 1000).padStart(3, '0').replace(/0+$/, '')
  const texto = decimales ? `${entero}.${decimales}` : String(entero)
  return cantidad.milesimas < 0 ? `-${texto}` : texto
}

export function formatearCantidad(cantidad: Cantidad, unidad: Unidad): string {
  return `${formatearNumero(cantidad)} ${SIMBOLO_DE_UNIDAD[unidad]}`
}

export function formatearEntero(n: number): string {
  return agrupar(n, ' ')
}

export function formatearDia(dia: Dia): string {
  const [anio, mes, d] = dia.split('-')
  return `${d}/${mes}/${anio}`
}

export function plural(n: number, singular: string, enPlural: string): string {
  return n === 1 ? singular : enPlural
}
```
(`Dia` lo define la Tarea 6; si se ejecuta antes, hacer la Tarea 6 primero.)

- [ ] **Paso 4:** PASS. **Paso 5:** commit `feat(shared): formato único de montos, cantidades y fechas`.

---

### Tarea 6: Fechas de negocio (`Instante`, `Dia`)

**Archivos:** crear `src/shared/domain/fecha.ts`, `src/shared/domain/fecha.spec.ts`.

**Produce:**
```ts
type Instante = string  // ISO 8601 en UTC, p. ej. "2026-10-15T15:00:00.000Z"
type Dia = string       // "AAAA-MM-DD" en la zona de la tienda (America/Lima, UTC−5)
diaDe(i: Instante): Dia
instanteLocal(texto: string): Instante   // "2026-10-15 10:00" hora de Lima → Instante
inicioDelDia(d: Dia): Instante
sumarDias(d: Dia, n: number): Dia
diasEntre(desde: Dia, hasta: Dia): number   // hasta − desde
diaDeLaSemana(d: Dia): number               // 1 = lunes … 7 = domingo
sumarSegundos(i: Instante, s: number): Instante
segundosEntre(desde: Instante, hasta: Instante): number
```

- [ ] **Paso 1: test que falla**

```ts
import { describe, expect, it } from 'vitest'
import { diaDe, diaDeLaSemana, diasEntre, inicioDelDia, instanteLocal, segundosEntre, sumarDias, sumarSegundos } from './fecha'

describe('fecha de negocio (America/Lima, UTC−5)', () => {
  it('convierte hora local de la tienda a instante UTC', () => {
    expect(instanteLocal('2026-10-15 10:00')).toBe('2026-10-15T15:00:00.000Z')
    expect(instanteLocal('2026-10-07 23:59')).toBe('2026-10-08T04:59:00.000Z')
  })
  it('el día depende de la zona de la tienda, no de UTC', () => {
    expect(diaDe('2026-10-16T04:59:00.000Z')).toBe('2026-10-15')
    expect(diaDe('2026-10-16T05:00:00.000Z')).toBe('2026-10-16')
    expect(inicioDelDia('2026-10-15')).toBe('2026-10-15T05:00:00.000Z')
  })
  it('suma y resta días cruzando meses', () => {
    expect(sumarDias('2026-09-30', 1)).toBe('2026-10-01')
    expect(sumarDias('2026-10-15', -28)).toBe('2026-09-17')
    expect(diasEntre('2026-09-17', '2026-10-15')).toBe(28)
  })
  it('día de la semana empieza en lunes', () => {
    expect(diaDeLaSemana('2026-10-15')).toBe(4) // jueves
    expect(diaDeLaSemana('2026-10-17')).toBe(6) // sábado
    expect(diaDeLaSemana('2026-10-18')).toBe(7) // domingo
  })
  it('suma y mide segundos', () => {
    const a = instanteLocal('2026-10-15 10:00')
    expect(segundosEntre(a, sumarSegundos(a, 11))).toBe(11)
  })
})
```

- [ ] **Paso 2:** FAIL.

- [ ] **Paso 3: implementación**

```ts
/** Instante absoluto en ISO 8601 UTC. */
export type Instante = string
/** Día de negocio "AAAA-MM-DD" en la zona de la tienda. */
export type Dia = string

/** Perú no usa horario de verano: America/Lima es siempre UTC−5. */
const DESFASE_MS = -5 * 60 * 60 * 1000
const MS_POR_DIA = 24 * 60 * 60 * 1000

export function diaDe(instante: Instante): Dia {
  return new Date(Date.parse(instante) + DESFASE_MS).toISOString().slice(0, 10)
}

/** "AAAA-MM-DD HH:mm" en hora de la tienda → Instante. */
export function instanteLocal(texto: string): Instante {
  const [dia, hora = '00:00'] = texto.trim().split(/\s+/)
  return new Date(Date.parse(`${dia}T${hora}:00.000Z`) - DESFASE_MS).toISOString()
}

export function inicioDelDia(dia: Dia): Instante {
  return instanteLocal(`${dia} 00:00`)
}

export function sumarDias(dia: Dia, n: number): Dia {
  return new Date(Date.parse(`${dia}T00:00:00.000Z`) + n * MS_POR_DIA).toISOString().slice(0, 10)
}

export function diasEntre(desde: Dia, hasta: Dia): number {
  return Math.round((Date.parse(`${hasta}T00:00:00.000Z`) - Date.parse(`${desde}T00:00:00.000Z`)) / MS_POR_DIA)
}

export function diaDeLaSemana(dia: Dia): number {
  const domingoEsCero = new Date(`${dia}T00:00:00.000Z`).getUTCDay()
  return domingoEsCero === 0 ? 7 : domingoEsCero
}

export function sumarSegundos(instante: Instante, segundos: number): Instante {
  return new Date(Date.parse(instante) + segundos * 1000).toISOString()
}

export function segundosEntre(desde: Instante, hasta: Instante): number {
  return (Date.parse(hasta) - Date.parse(desde)) / 1000
}
```

- [ ] **Paso 4:** PASS. **Paso 5:** commit `feat(shared): fechas de negocio en zona de la tienda`.

---

### Tarea 7: Reloj, generador de ids y bus de eventos

**Archivos:** crear `src/shared/domain/reloj.ts`, `ids.ts`, `eventos.ts`, `eventos.spec.ts`, `reloj.spec.ts`.

**Produce:**
```ts
interface Reloj { ahora(): Instante }
class RelojDelSistema implements Reloj
class RelojFijo implements Reloj { constructor(inicial: Instante); fijar(i: Instante): void; avanzarSegundos(s: number): void }
interface GeneradorDeIds { nuevo(): string }
class IdsAleatorios implements GeneradorDeIds      // crypto.randomUUID()
class IdsSecuenciales implements GeneradorDeIds    // "id-1", "id-2", … (tests)
type EventoDeDominio = …   // ver código
interface BusDeEventos { publicar(e: EventoDeDominio): Promise<void>; suscribir<T extends EventoDeDominio['tipo']>(tipo: T, manejador: (e: Extract<EventoDeDominio, { tipo: T }>) => Promise<void> | void): () => void }
class BusEnMemoria implements BusDeEventos
```

- [ ] **Paso 1: tests que fallan**

`reloj.spec.ts`
```ts
import { describe, expect, it } from 'vitest'
import { RelojFijo } from './reloj'
import { IdsSecuenciales } from './ids'

describe('RelojFijo e IdsSecuenciales', () => {
  it('avanza segundos de forma controlada', () => {
    const reloj = new RelojFijo('2026-10-15T15:00:00.000Z')
    reloj.avanzarSegundos(11)
    expect(reloj.ahora()).toBe('2026-10-15T15:00:11.000Z')
  })
  it('genera ids predecibles en pruebas', () => {
    const ids = new IdsSecuenciales('op')
    expect([ids.nuevo(), ids.nuevo()]).toEqual(['op-1', 'op-2'])
  })
})
```

`eventos.spec.ts`
```ts
import { describe, expect, it } from 'vitest'
import { BusEnMemoria } from './eventos'

describe('BusEnMemoria', () => {
  it('entrega cada evento solo a los suscriptores de su tipo, en orden', async () => {
    const bus = new BusEnMemoria()
    const recibidos: string[] = []
    bus.suscribir('ProductoCreado', (e) => { recibidos.push(`creado:${e.productoId}`) })
    bus.suscribir('OperacionRegistrada', async (e) => { recibidos.push(`op:${e.operacionId}`) })
    await bus.publicar({ tipo: 'ProductoCreado', productoId: 'p1' })
    await bus.publicar({ tipo: 'OperacionRegistrada', operacionId: 'o1', tipoOperacion: 'VENTA', productoIds: ['p1'] })
    expect(recibidos).toEqual(['creado:p1', 'op:o1'])
  })
  it('permite cancelar la suscripción', async () => {
    const bus = new BusEnMemoria()
    let veces = 0
    const cancelar = bus.suscribir('ConfiguracionActualizada', () => { veces++ })
    cancelar()
    await bus.publicar({ tipo: 'ConfiguracionActualizada' })
    expect(veces).toBe(0)
  })
})
```

- [ ] **Paso 2:** FAIL.

- [ ] **Paso 3: implementación**

`reloj.ts`
```ts
import { sumarSegundos, type Instante } from './fecha'

export interface Reloj {
  ahora(): Instante
}

export class RelojDelSistema implements Reloj {
  ahora(): Instante {
    return new Date().toISOString()
  }
}

export class RelojFijo implements Reloj {
  constructor(private actual: Instante) {}
  ahora(): Instante {
    return this.actual
  }
  fijar(instante: Instante): void {
    this.actual = instante
  }
  avanzarSegundos(segundos: number): void {
    this.actual = sumarSegundos(this.actual, segundos)
  }
}
```

`ids.ts`
```ts
export interface GeneradorDeIds {
  nuevo(): string
}

export class IdsAleatorios implements GeneradorDeIds {
  nuevo(): string {
    return crypto.randomUUID()
  }
}

export class IdsSecuenciales implements GeneradorDeIds {
  private contador = 0
  constructor(private readonly prefijo = 'id') {}
  nuevo(): string {
    this.contador += 1
    return `${this.prefijo}-${this.contador}`
  }
}
```
(`crypto.randomUUID` existe en navegadores modernos y en Node 24; no es una API de framework.)

`eventos.ts`
```ts
import type { TipoDeOperacion } from '../contratos/operaciones'

export type EventoDeDominio =
  | { tipo: 'ProductoCreado'; productoId: string }
  | { tipo: 'ProductoActualizado'; productoId: string }
  | { tipo: 'ProductoArchivado'; productoId: string }
  | { tipo: 'ProductoReactivado'; productoId: string }
  | { tipo: 'OperacionRegistrada'; operacionId: string; tipoOperacion: TipoDeOperacion; productoIds: string[] }
  | { tipo: 'OperacionAnulada'; operacionId: string; anulacionId: string; productoIds: string[] }
  | { tipo: 'ConfiguracionActualizada' }

export type TipoDeEvento = EventoDeDominio['tipo']
export type EventoDe<T extends TipoDeEvento> = Extract<EventoDeDominio, { tipo: T }>
export type ManejadorDeEvento<T extends TipoDeEvento> = (evento: EventoDe<T>) => Promise<void> | void

export interface BusDeEventos {
  publicar(evento: EventoDeDominio): Promise<void>
  suscribir<T extends TipoDeEvento>(tipo: T, manejador: ManejadorDeEvento<T>): () => void
}

/** Bus síncrono en el mismo proceso. Se publica DESPUÉS de confirmar la unidad de trabajo. */
export class BusEnMemoria implements BusDeEventos {
  private readonly manejadores = new Map<TipoDeEvento, Set<(e: EventoDeDominio) => Promise<void> | void>>()

  async publicar(evento: EventoDeDominio): Promise<void> {
    for (const manejador of this.manejadores.get(evento.tipo) ?? []) {
      await manejador(evento)
    }
  }

  suscribir<T extends TipoDeEvento>(tipo: T, manejador: ManejadorDeEvento<T>): () => void {
    const lista = this.manejadores.get(tipo) ?? new Set()
    const envoltura = (e: EventoDeDominio) => manejador(e as EventoDe<T>)
    lista.add(envoltura)
    this.manejadores.set(tipo, lista)
    return () => lista.delete(envoltura)
  }
}
```
(Requiere `src/shared/contratos/operaciones.ts` de la Tarea 8; crear ese archivo primero si hace falta.)

- [ ] **Paso 4:** PASS. **Paso 5:** commit `feat(shared): reloj, ids y bus de eventos de dominio`.

---

### Tarea 8: Contratos entre módulos, registros persistidos y unidad de trabajo

Esta tarea define **las interfaces que usarán los cinco módulos de la Ola 2**. Copiar los tipos tal cual: otros agentes programan contra estos nombres.

**Archivos:** crear `src/shared/contratos/{estado-de-stock,operaciones,configuracion,registros,entre-modulos}.ts`, `src/shared/application/unidad-de-trabajo.ts`, `src/shared/infrastructure/memoria/{almacen-en-memoria,unidad-de-trabajo-en-memoria}.ts` y su test.

- [ ] **Paso 1: tipos de contrato** (sin lógica, sin test)

`src/shared/contratos/estado-de-stock.ts`
```ts
/** Estado de stock de un producto activo (03-alertas). */
export type EstadoDeStock = 'AGOTADO' | 'POR_ACABARSE' | 'NORMAL'

/** Mayor número = más grave. */
export const GRAVEDAD_DE_ESTADO: Record<EstadoDeStock, number> = { NORMAL: 0, POR_ACABARSE: 1, AGOTADO: 2 }
```

`src/shared/contratos/operaciones.ts`
```ts
export type TipoDeOperacion = 'STOCK_INICIAL' | 'INGRESO' | 'VENTA' | 'MERMA' | 'AJUSTE' | 'ANULACION'

export const MOTIVOS_DE_MERMA = ['Se dañó o rompió', 'Se derramó', 'Se venció', 'Otro'] as const
export type MotivoDeMerma = (typeof MOTIVOS_DE_MERMA)[number]

export const MOTIVO_PRODUCTO_RETIRADO = 'Producto retirado'
export const MOTIVO_CONTEO = 'Conteo de stock'
```

`src/shared/contratos/configuracion.ts`
```ts
export type TamanoDeLetra = 'NORMAL' | 'GRANDE' | 'MUY_GRANDE'

export interface ConfiguracionDeNegocio {
  nombreTienda: string
  diasEntreCompras: number
  diasAnticipacion: number
  diasMaximosDeCompra: number
  tamanoDeLetra: TamanoDeLetra
  notificacionesActivas: boolean
}

export const CONFIGURACION_INICIAL: ConfiguracionDeNegocio = {
  nombreTienda: '',
  diasEntreCompras: 7,
  diasAnticipacion: 3,
  diasMaximosDeCompra: 30,
  tamanoDeLetra: 'GRANDE',
  notificacionesActivas: false,
}

export const RANGOS_DE_CONFIGURACION = {
  nombreTienda: { min: 1, max: 40 },
  diasEntreCompras: { min: 1, max: 60 },
  diasAnticipacion: { min: 1, max: 14 },
  diasMaximosDeCompra: { min: 7, max: 180 },
} as const

export type EstadoDeAlmacenamiento = 'DESCONOCIDO' | 'CONCEDIDO' | 'RECHAZADO'

/** Estado técnico de la instalación (no es configuración del negocio). */
export interface EstadoDelSistema {
  dispositivoId: string
  primeraVezCompletada: boolean
  ultimoRespaldoEn: string | null
  almacenamientoPersistente: EstadoDeAlmacenamiento
  ultimoResumenDelDiaMostrado: string | null
}
```

`src/shared/contratos/registros.ts` — **forma persistida** (Dexie, memoria y respaldo). Solo números, textos, booleanos, arreglos y `Blob`.
```ts
import type { Unidad } from '../domain/cantidad'
import type { ConfiguracionDeNegocio, EstadoDelSistema } from './configuracion'
import type { EstadoDeStock } from './estado-de-stock'
import type { TipoDeOperacion } from './operaciones'

export interface ProductoRegistro {
  id: string
  nombre: string
  nombreNormalizado: string
  categoriaId: string
  unidad: Unidad
  precioCompra: number // céntimos
  precioVenta: number // céntimos
  stockMinimo: number // milésimas
  tieneFoto: boolean
  estado: 'ACTIVO' | 'ARCHIVADO'
  creadoEn: string
  actualizadoEn: string
}

export interface CategoriaRegistro {
  id: string
  nombre: string
  nombreNormalizado: string
}

export interface MovimientoRegistro {
  productoId: string
  cantidad: number // milésimas, con signo (+ entra, − sale)
  costoUnitario: number // céntimos
  precioUnitario: number | null // céntimos; solo en VENTA
}

export interface OperacionRegistro {
  id: string
  tipo: TipoDeOperacion
  movimientos: MovimientoRegistro[]
  productoIds: string[] // índice multiEntry
  ocurridaEn: string
  registradaEn: string
  motivo: string | null
  nota: string | null
  anulaA: string | null
  dispositivoId: string
}

export interface ExistenciaRegistro {
  productoId: string
  cantidad: number // milésimas
}

export interface ResumenDiarioRegistro {
  clave: string // `${productoId}|${dia}`
  productoId: string
  dia: string
  lineasVendidas: number
  cantidadVendida: number // milésimas
  ventas: number // céntimos
  costoVendido: number // céntimos
  costoMermas: number // céntimos
  valorAjustes: number // céntimos, con signo
  cambioNeto: number // milésimas, con signo: todas las operaciones del día, incluidas anulaciones
}

export interface ConfiguracionRegistro extends ConfiguracionDeNegocio {
  clave: 'negocio'
}

export interface EstadoDelSistemaRegistro extends EstadoDelSistema {
  clave: 'sistema'
}

export interface AvisoRegistro {
  productoId: string
  ultimoEstadoAvisado: EstadoDeStock
}

export interface CambioEnListaRegistro {
  productoId: string
  cantidad: number | null // milésimas; null = quitado de la lista
}

export interface ListaDeComprasRegistro {
  dia: string
  cambios: CambioEnListaRegistro[]
}

export interface ConteoGuiadoRegistro {
  id: 'actual'
  iniciadoEn: string
  orden: string[] // productoIds en el orden del recorrido
  posicion: number // índice del producto actual en `orden`
  contados: { productoId: string; diferencia: number; valor: number }[] // milésimas, céntimos
  saltados: string[]
  terminadoEn: string | null
}

export interface FotoRegistro {
  productoId: string
  imagen: Blob
}

/** Nombre de cada tabla y la forma de sus registros. */
export interface TablasDeLaApp {
  productos: ProductoRegistro
  categorias: CategoriaRegistro
  operaciones: OperacionRegistro
  existencias: ExistenciaRegistro
  resumenes: ResumenDiarioRegistro
  configuracion: ConfiguracionRegistro | EstadoDelSistemaRegistro
  avisos: AvisoRegistro
  listaDeCompras: ListaDeComprasRegistro
  conteo: ConteoGuiadoRegistro
  fotos: FotoRegistro
}

export type NombreDeTabla = keyof TablasDeLaApp

/** Clave primaria de cada tabla (igual en Dexie y en memoria). */
export const CLAVE_DE_TABLA: { [K in NombreDeTabla]: keyof TablasDeLaApp[K] & string } = {
  productos: 'id',
  categorias: 'id',
  operaciones: 'id',
  existencias: 'productoId',
  resumenes: 'clave',
  configuracion: 'clave',
  avisos: 'productoId',
  listaDeCompras: 'dia',
  conteo: 'id',
  fotos: 'productoId',
}
```

`src/shared/contratos/entre-modulos.ts` — **lo que cada módulo ofrece a los demás**. Cada módulo implementa su interfaz; la composición (Ola 3) las conecta.
```ts
import type { Cantidad, Unidad } from '../domain/cantidad'
import type { Dinero } from '../domain/dinero'
import type { Dia, Instante } from '../domain/fecha'
import type { ConfiguracionDeNegocio, EstadoDelSistema } from './configuracion'
import type { EstadoDeStock } from './estado-de-stock'
import type { OperacionRegistro } from './registros'

// ───────────── Catálogo ofrece ─────────────

export interface ProductoResumido {
  id: string
  nombre: string
  unidad: Unidad
  categoriaId: string
  categoriaNombre: string
  precioCompra: Dinero
  precioVenta: Dinero
  stockMinimo: Cantidad
  activo: boolean
  tieneFoto: boolean
}

/** Datos de un producto nuevo tal como los escribe el usuario (formulario o Excel). */
export interface DatosDeProductoNuevo {
  nombre: string
  categoriaId: string
  unidad: Unidad
  precioCompra: string
  precioVenta: string
  stockMinimo: string
  stockInicial?: string
}

export interface CatalogoConsultable {
  producto(id: string): Promise<ProductoResumido | null>
  productos(filtro?: { soloActivos?: boolean }): Promise<ProductoResumido[]>
  /** RN-OP-14: lo usa Inventario al aceptar el nuevo costo de un ingreso. */
  actualizarPrecioCompra(id: string, precio: Dinero): Promise<void>
}

/** Lo que Respaldo necesita para importar desde Excel (RN-RE-07, RN-RE-08). */
export interface CatalogoParaImportacion {
  /** Devuelve el mensaje de error de la primera regla que falla, o null si es válido. No guarda nada. */
  validarNuevo(datos: DatosDeProductoNuevo): Promise<string | null>
  crear(datos: DatosDeProductoNuevo): Promise<string>
  categoriaPorNombre(nombre: string): Promise<string | null>
  crearCategoria(nombre: string): Promise<string>
}

// ───────────── Inventario ofrece ─────────────

export interface InventarioConsultable {
  stockDe(productoId: string): Promise<Cantidad>
  existencias(): Promise<Map<string, Cantidad>>
  tieneOperaciones(productoId: string): Promise<boolean>
  ultimoIngresoDe(productoId: string): Promise<Instante | null>
  operaciones(): Promise<OperacionRegistro[]>
}

export interface InventarioParaCatalogo extends InventarioConsultable {
  registrarStockInicial(productoId: string, cantidad: Cantidad, costoUnitario: Dinero): Promise<void>
  /** RN-CAT-11: AJUSTE hasta 0 con motivo "Producto retirado". */
  retirarStock(productoId: string): Promise<void>
}

/** Proyecciones que se actualizan en la MISMA unidad de trabajo que la operación (ADR-0002). */
export interface ProyeccionDeOperaciones {
  alRegistrar(operacion: OperacionRegistro): Promise<void>
  alAnular(original: OperacionRegistro, anulacion: OperacionRegistro): Promise<void>
  reconstruir(operaciones: readonly OperacionRegistro[]): Promise<void>
}

// ───────────── Análisis ofrece ─────────────

/** VPD = vendido ÷ diasValidos (RN-AN-04). Se guarda como fracción para no perder exactitud. */
export interface Prediccion {
  vendido: Cantidad
  diasValidos: number
}

export interface SituacionDeProducto {
  productoId: string
  nombre: string
  unidad: Unidad
  stock: Cantidad
  stockMinimo: Cantidad
  prediccion: Prediccion | null
  diasDeCobertura: number | null
  estado: EstadoDeStock
  enListaParaComprar: boolean
  cantidadSugerida: Cantidad | null
  parado: { diasSinVender: number } | null
}

export interface AnalisisConsultable {
  situacion(productoId: string): Promise<SituacionDeProducto | null>
  /** Solo productos activos. */
  situaciones(): Promise<SituacionDeProducto[]>
  vecesVendido(desde: Dia, hasta: Dia): Promise<Map<string, number>>
  totalesDelDia(dia: Dia): Promise<{ ventas: Dinero; gananciaNeta: Dinero }>
}

// ───────────── Tienda ofrece ─────────────

export interface TiendaConsultable {
  configuracion(): Promise<ConfiguracionDeNegocio>
  estadoDelSistema(): Promise<EstadoDelSistema>
  actualizarEstadoDelSistema(cambios: Partial<EstadoDelSistema>): Promise<void>
}
```

`src/shared/application/unidad-de-trabajo.ts`
```ts
/**
 * Agrupa escrituras en una transacción: o se guardan todas o ninguna (RN-OP-06).
 * Llamadas anidadas se unen a la transacción en curso.
 */
export interface UnidadDeTrabajo {
  ejecutar<T>(trabajo: () => Promise<T>): Promise<T>
}
```

- [ ] **Paso 2: test que falla** — `src/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria.spec.ts`

```ts
import { describe, expect, it } from 'vitest'
import { AlmacenEnMemoria } from './almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from './unidad-de-trabajo-en-memoria'

const existencia = (productoId: string, cantidad: number) => ({ productoId, cantidad })

describe('UnidadDeTrabajoEnMemoria', () => {
  it('confirma todas las escrituras si el trabajo termina bien', async () => {
    const almacen = new AlmacenEnMemoria()
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    await uow.ejecutar(async () => {
      almacen.guardar('existencias', existencia('p1', 1000))
      almacen.guardar('existencias', existencia('p2', 2000))
    })
    expect(almacen.todos('existencias')).toHaveLength(2)
  })
  it('RN-OP-06: deshace todas las escrituras si el trabajo falla', async () => {
    const almacen = new AlmacenEnMemoria()
    almacen.guardar('existencias', existencia('p1', 1000))
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    await expect(
      uow.ejecutar(async () => {
        almacen.guardar('existencias', existencia('p1', 0))
        almacen.guardar('existencias', existencia('p2', 5000))
        throw new Error('falla a mitad')
      }),
    ).rejects.toThrow('falla a mitad')
    expect(almacen.obtener('existencias', 'p1')?.cantidad).toBe(1000)
    expect(almacen.obtener('existencias', 'p2')).toBeUndefined()
  })
  it('las llamadas anidadas se unen a la transacción externa', async () => {
    const almacen = new AlmacenEnMemoria()
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    await expect(
      uow.ejecutar(async () => {
        await uow.ejecutar(async () => { almacen.guardar('existencias', existencia('p1', 1000)) })
        throw new Error('falla externa')
      }),
    ).rejects.toThrow()
    expect(almacen.obtener('existencias', 'p1')).toBeUndefined()
  })
  it('devuelve copias: modificar lo leído no cambia lo guardado', () => {
    const almacen = new AlmacenEnMemoria()
    almacen.guardar('existencias', existencia('p1', 1000))
    const leido = almacen.obtener('existencias', 'p1')!
    leido.cantidad = 0
    expect(almacen.obtener('existencias', 'p1')?.cantidad).toBe(1000)
  })
})
```

- [ ] **Paso 3:** FAIL.

- [ ] **Paso 4: implementación**

`src/shared/infrastructure/memoria/almacen-en-memoria.ts`
```ts
import { CLAVE_DE_TABLA, type NombreDeTabla, type TablasDeLaApp } from '../../contratos/registros'

type Tablas = { [K in NombreDeTabla]: Map<string, TablasDeLaApp[K]> }

function copiar<T>(valor: T): T {
  // Los Blob (fotos) no se copian: son inmutables.
  if (valor && typeof valor === 'object' && 'imagen' in valor) return { ...valor }
  return structuredClone(valor)
}

/** Base de datos en memoria con las mismas tablas que Dexie. Para pruebas y para la composición de pruebas. */
export class AlmacenEnMemoria {
  private tablas: Tablas = AlmacenEnMemoria.vacias()

  private static vacias(): Tablas {
    return {
      productos: new Map(), categorias: new Map(), operaciones: new Map(), existencias: new Map(),
      resumenes: new Map(), configuracion: new Map(), avisos: new Map(), listaDeCompras: new Map(),
      conteo: new Map(), fotos: new Map(),
    }
  }

  guardar<K extends NombreDeTabla>(tabla: K, registro: TablasDeLaApp[K]): void {
    const clave = String(registro[CLAVE_DE_TABLA[tabla] as keyof TablasDeLaApp[K]])
    this.tablas[tabla].set(clave, copiar(registro))
  }

  obtener<K extends NombreDeTabla>(tabla: K, clave: string): TablasDeLaApp[K] | undefined {
    const registro = this.tablas[tabla].get(clave)
    return registro === undefined ? undefined : copiar(registro)
  }

  todos<K extends NombreDeTabla>(tabla: K): TablasDeLaApp[K][] {
    return [...this.tablas[tabla].values()].map(copiar)
  }

  eliminar<K extends NombreDeTabla>(tabla: K, clave: string): void {
    this.tablas[tabla].delete(clave)
  }

  vaciar<K extends NombreDeTabla>(tabla: K): void {
    this.tablas[tabla].clear()
  }

  /** Copia superficial de todas las tablas (los registros nunca se mutan en sitio). */
  instantanea(): Tablas {
    const copia = AlmacenEnMemoria.vacias()
    for (const nombre of Object.keys(this.tablas) as NombreDeTabla[]) {
      ;(copia[nombre] as Map<string, unknown>) = new Map(this.tablas[nombre] as Map<string, unknown>)
    }
    return copia
  }

  restaurar(instantanea: Tablas): void {
    this.tablas = instantanea
  }
}
```

`src/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria.ts`
```ts
import type { UnidadDeTrabajo } from '../../application/unidad-de-trabajo'
import type { AlmacenEnMemoria } from './almacen-en-memoria'

export class UnidadDeTrabajoEnMemoria implements UnidadDeTrabajo {
  private profundidad = 0

  constructor(private readonly almacen: AlmacenEnMemoria) {}

  async ejecutar<T>(trabajo: () => Promise<T>): Promise<T> {
    if (this.profundidad > 0) return trabajo()
    const antes = this.almacen.instantanea()
    this.profundidad++
    try {
      return await trabajo()
    } catch (error) {
      this.almacen.restaurar(antes)
      throw error
    } finally {
      this.profundidad--
    }
  }
}
```

- [ ] **Paso 5:** `npx vitest run src/shared && npm run type-check` → PASS.
- [ ] **Paso 6:** commit `feat(shared): contratos entre módulos, registros y unidad de trabajo en memoria`.

---

### Tarea 9: Runner de Gherkin para Vitest

**Archivos:** crear `tests/gherkin/registro-de-pasos.ts`, `tests/gherkin/ejecutar-feature.ts`, `tests/gherkin/registro-de-pasos.spec.ts`, `tests/gherkin/ejecutar-feature.spec.ts`, `tests/gherkin/__fixtures__/ejemplo.feature`.

**Produce:**
```ts
interface TablaDeDatos { filas: Record<string, string>[]; celdas: string[][] }
interface ArgumentoExtra { tabla?: TablaDeDatos; texto?: string }
class RegistroDePasos<M> {
  paso(expresion: string, manejador: (mundo: M, ...args: any[]) => unknown): this   // Cucumber Expression
  buscar(texto: string): { manejador; argumentos: unknown[] } | null                // lanza si es ambiguo
  unir(otro: RegistroDePasos<M>): RegistroDePasos<M>
}
function ejecutarFeature<M>(ruta: string, pasos: RegistroDePasos<M>, crearMundo: () => M | Promise<M>): void
```
Los manejadores reciben `(mundo, ...parametrosDeLaExpresion, extra: ArgumentoExtra)`; `extra` va **siempre** al final. Con `GHERKIN_ESTRICTO=1`, un escenario con pasos sin definir **falla**; sin esa variable queda como pendiente (`it.skip`).

- [ ] **Paso 1: fixture** — `tests/gherkin/__fixtures__/ejemplo.feature`

```gherkin
# language: es
Característica: Calculadora de ejemplo

  Antecedentes:
    Dado que tengo "2" manzanas

  @RN-EJ-01
  Escenario: Sumar con una tabla
    Cuando recibo:
      | fruta   | cantidad |
      | manzana | 3        |
    Entonces tengo "5" manzanas

  Esquema del escenario: Sumar varias veces
    Cuando recibo "<n>" manzanas
    Entonces tengo "<total>" manzanas

    Ejemplos:
      | n | total |
      | 1 | 3     |
      | 4 | 6     |

  Escenario: Texto largo
    Cuando anoto:
      """
      Hola
      mundo
      """
    Entonces la nota tiene "2" líneas

  Escenario: Paso que nadie definió
    Cuando hago algo que no existe
```

- [ ] **Paso 2: tests que fallan**

`tests/gherkin/registro-de-pasos.spec.ts`
```ts
import { describe, expect, it } from 'vitest'
import { RegistroDePasos } from './registro-de-pasos'

describe('RegistroDePasos', () => {
  it('encuentra pasos con parámetros {string} y texto opcional', () => {
    const pasos = new RegistroDePasos<object>().paso('(que )vendo {string} de {string}', () => {})
    expect(pasos.buscar('vendo "2" de "Lejía 1 L"')?.argumentos).toEqual(['2', 'Lejía 1 L'])
    expect(pasos.buscar('que vendo "2" de "Lejía 1 L"')?.argumentos).toEqual(['2', 'Lejía 1 L'])
    expect(pasos.buscar('compro "2"')).toBeNull()
  })
  it('falla si un texto coincide con dos pasos', () => {
    const pasos = new RegistroDePasos<object>().paso('vendo {string}', () => {}).paso('vendo {string}', () => {})
    expect(() => pasos.buscar('vendo "2"')).toThrow('ambiguo')
  })
  it('une registros de varios archivos de pasos', () => {
    const a = new RegistroDePasos<object>().paso('paso a', () => {})
    const b = new RegistroDePasos<object>().paso('paso b', () => {})
    const todos = a.unir(b)
    expect(todos.buscar('paso a')).not.toBeNull()
    expect(todos.buscar('paso b')).not.toBeNull()
  })
})
```

`tests/gherkin/ejecutar-feature.spec.ts`
```ts
import { fileURLToPath } from 'node:url'
import { expect } from 'vitest'
import { ejecutarFeature } from './ejecutar-feature'
import { RegistroDePasos, type ArgumentoExtra } from './registro-de-pasos'

interface Mundo { manzanas: number; nota: string }

const pasos = new RegistroDePasos<Mundo>()
  .paso('que tengo {string} manzanas', (m, n: string) => { m.manzanas = Number(n) })
  .paso('recibo:', (m, extra: ArgumentoExtra) => {
    for (const fila of extra.tabla!.filas) m.manzanas += Number(fila.cantidad)
  })
  .paso('recibo {string} manzanas', (m, n: string) => { m.manzanas += Number(n) })
  .paso('tengo {string} manzanas', (m, n: string) => { expect(m.manzanas).toBe(Number(n)) })
  .paso('anoto:', (m, extra: ArgumentoExtra) => { m.nota = extra.texto! })
  .paso('la nota tiene {string} líneas', (m, n: string) => { expect(m.nota.split('\n')).toHaveLength(Number(n)) })

// Genera: 1 + 2 + 1 escenarios en verde y 1 pendiente (skip) por el paso sin definir.
ejecutarFeature(
  fileURLToPath(new URL('./__fixtures__/ejemplo.feature', import.meta.url)),
  pasos,
  () => ({ manzanas: 0, nota: '' }),
)
```

- [ ] **Paso 3:** `npx vitest run tests/gherkin` → FAIL (módulos no existen).

- [ ] **Paso 4: implementación**

`tests/gherkin/registro-de-pasos.ts`
```ts
import { CucumberExpression, ParameterTypeRegistry } from '@cucumber/cucumber-expressions'

export interface TablaDeDatos {
  /** Filas como objetos usando la primera fila como encabezados. */
  filas: Record<string, string>[]
  /** Todas las celdas, incluida la fila de encabezados. */
  celdas: string[][]
}

export interface ArgumentoExtra {
  tabla?: TablaDeDatos
  texto?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cada paso declara sus propios parámetros
export type ManejadorDePaso<M> = (mundo: M, ...args: any[]) => unknown

interface DefinicionDePaso<M> {
  texto: string
  expresion: CucumberExpression
  manejador: ManejadorDePaso<M>
}

export class RegistroDePasos<M> {
  private readonly definiciones: DefinicionDePaso<M>[] = []
  private readonly tipos = new ParameterTypeRegistry()

  paso(texto: string, manejador: ManejadorDePaso<M>): this {
    this.definiciones.push({ texto, expresion: new CucumberExpression(texto, this.tipos), manejador })
    return this
  }

  buscar(texto: string): { manejador: ManejadorDePaso<M>; argumentos: unknown[] } | null {
    const coincidencias = this.definiciones.flatMap((d) => {
      const argumentos = d.expresion.match(texto)
      return argumentos ? [{ definicion: d, argumentos: argumentos.map((a) => a.getValue(null)) }] : []
    })
    if (coincidencias.length > 1) {
      throw new Error(`Paso ambiguo "${texto}": ${coincidencias.map((c) => c.definicion.texto).join(' | ')}`)
    }
    const [unica] = coincidencias
    return unica ? { manejador: unica.definicion.manejador, argumentos: unica.argumentos } : null
  }

  unir(otro: RegistroDePasos<M>): RegistroDePasos<M> {
    const todos = new RegistroDePasos<M>()
    for (const d of [...this.definiciones, ...otro.definiciones]) todos.paso(d.texto, d.manejador)
    return todos
  }
}
```

`tests/gherkin/ejecutar-feature.ts`
```ts
import { readFileSync } from 'node:fs'
import { AstBuilder, GherkinClassicTokenMatcher, Parser, compile } from '@cucumber/gherkin'
import { IdGenerator, type PickleStep } from '@cucumber/messages'
import { describe, it } from 'vitest'
import type { ArgumentoExtra, RegistroDePasos } from './registro-de-pasos'

function argumentoExtra(paso: PickleStep): ArgumentoExtra {
  const extra: ArgumentoExtra = {}
  const tabla = paso.argument?.dataTable
  if (tabla) {
    const celdas = tabla.rows.map((fila) => fila.cells.map((c) => c.value))
    const [encabezados = [], ...resto] = celdas
    extra.tabla = {
      celdas,
      filas: resto.map((fila) => Object.fromEntries(encabezados.map((e, i) => [e, fila[i] ?? '']))),
    }
  }
  if (paso.argument?.docString) extra.texto = paso.argument.docString.content
  return extra
}

/** Convierte un .feature en tests de Vitest. Un paso sin definir deja el escenario pendiente (o lo hace fallar con GHERKIN_ESTRICTO=1). */
export function ejecutarFeature<M>(ruta: string, pasos: RegistroDePasos<M>, crearMundo: () => M | Promise<M>): void {
  const nuevoId = IdGenerator.uuid()
  const documento = new Parser(new AstBuilder(nuevoId), new GherkinClassicTokenMatcher('es')).parse(
    readFileSync(ruta, 'utf8'),
  )
  const pickles = compile(documento, ruta, nuevoId)
  const estricto = process.env.GHERKIN_ESTRICTO === '1'

  describe(documento.feature?.name ?? ruta, () => {
    for (const pickle of pickles) {
      const etiquetas = pickle.tags.map((t) => t.name).join(' ')
      const nombre = [etiquetas, pickle.name].filter(Boolean).join(' ')
      const faltante = pickle.steps.find((p) => pasos.buscar(p.text) === null)

      if (faltante && !estricto) {
        it.skip(`[pendiente] ${nombre} — falta el paso: ${faltante.text}`, () => {})
        continue
      }

      it(nombre, async () => {
        const mundo = await crearMundo()
        for (const paso of pickle.steps) {
          const encontrado = pasos.buscar(paso.text)
          if (!encontrado) throw new Error(`Paso sin definir: "${paso.text}"`)
          try {
            await encontrado.manejador(mundo, ...encontrado.argumentos, argumentoExtra(paso))
          } catch (error) {
            throw new Error(`Falló el paso "${paso.text}": ${(error as Error).message}`, { cause: error })
          }
        }
      })
    }
  })
}
```

- [ ] **Paso 5:** `npx vitest run tests/gherkin` → PASS (4 escenarios en verde, 1 omitido). Luego `GHERKIN_ESTRICTO=1 npx vitest run tests/gherkin/ejecutar-feature.spec.ts` → FAIL en "Paso que nadie definió" (comprueba el modo estricto; en PowerShell: `$env:GHERKIN_ESTRICTO='1'; npx vitest run …`).
- [ ] **Paso 6:** commit `test(gherkin): runner de features en español sobre Vitest`.

---

### Tarea 10: Verificación de specs (RN-SIS-01) y arnés de aceptación

**Archivos:** crear `scripts/verificar-specs.mjs`, `scripts/verificar-specs.spec.ts`; crear `tests/aceptacion/{catalogo,operaciones,alertas,torre-de-control,respaldo}.feature.spec.ts`.

- [ ] **Paso 1: test que falla** — `scripts/verificar-specs.spec.ts` (agregar `'scripts/**/*.spec.ts'` al `include` de `vitest.config.ts` y a `tsconfig.vitest.json`)

```ts
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { verificarSpecs } from './verificar-specs.mjs'

function proyecto(md: string, feature: string): string {
  const raiz = mkdtempSync(join(tmpdir(), 'specs-'))
  mkdirSync(join(raiz, 'fase-1', 'features'), { recursive: true })
  writeFileSync(join(raiz, 'fase-1', '01.md'), md)
  writeFileSync(join(raiz, 'fase-1', 'features', 'a.feature'), feature)
  return raiz
}

describe('verificarSpecs (RN-SIS-01)', () => {
  it('pasa con las specs reales del proyecto', () => {
    const r = verificarSpecs(join(import.meta.dirname, '..', '..', 'docs', 'specs'))
    expect(r.errores).toEqual([])
    expect(r.reglas).toBeGreaterThanOrEqual(68)
  })
  it('detecta una regla sin escenario', () => {
    const r = verificarSpecs(proyecto('| **RN-OP-01** | x |\n| **RN-OP-02** | y |', '@RN-OP-01\nEscenario: a'))
    expect(r.errores).toContain('RN-OP-02 no tiene escenario Gherkin')
  })
  it('detecta un escenario que cita una regla inexistente o retirada', () => {
    const r = verificarSpecs(proyecto('| **RN-OP-01** | x |\n| ~~RN-OP-02~~ | **Retirada** |', '@RN-OP-01 @RN-OP-02 @RN-OP-09\nEscenario: a'))
    expect(r.errores).toEqual(['@RN-OP-02 cita una regla retirada', '@RN-OP-09 cita una regla que no existe'])
  })
})
```

- [ ] **Paso 2:** FAIL.

- [ ] **Paso 3: implementación** — `scripts/verificar-specs.mjs`

```js
#!/usr/bin/env node
// RN-SIS-01: cada regla de negocio vigente tiene al menos un escenario, y ningún escenario cita reglas inexistentes o retiradas.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODULOS = '(?:CAT|OP|AL|AN|RE)'

function archivos(dir, extension) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivos(ruta, extension)
    return ruta.endsWith(extension) ? [ruta] : []
  })
}

export function verificarSpecs(directorioSpecs) {
  const md = archivos(directorioSpecs, '.md').map((f) => readFileSync(f, 'utf8')).join('\n')
  const features = archivos(directorioSpecs, '.feature').map((f) => readFileSync(f, 'utf8')).join('\n')
  const vigentes = new Set([...md.matchAll(new RegExp(`\\*\\*(RN-${MODULOS}-\\d{2})\\*\\*`, 'g'))].map((m) => m[1]))
  const retiradas = new Set([...md.matchAll(/~~(RN-[A-Z]+-\d{2})~~/g)].map((m) => m[1]))
  const etiquetas = new Set([...features.matchAll(/@(RN-[A-Z]+-\d{2})/g)].map((m) => m[1]))

  const errores = []
  for (const regla of [...vigentes].sort()) {
    if (!etiquetas.has(regla)) errores.push(`${regla} no tiene escenario Gherkin`)
  }
  for (const etiqueta of [...etiquetas].sort()) {
    if (retiradas.has(etiqueta)) errores.push(`@${etiqueta} cita una regla retirada`)
    else if (!vigentes.has(etiqueta)) errores.push(`@${etiqueta} cita una regla que no existe`)
  }
  return { reglas: vigentes.size, retiradas: retiradas.size, errores }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directorio = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'docs', 'specs')
  const { reglas, retiradas, errores } = verificarSpecs(directorio)
  if (errores.length > 0) {
    console.error(`✗ Specs con problemas:\n  - ${errores.join('\n  - ')}`)
    process.exit(1)
  }
  console.log(`✓ ${reglas} reglas vigentes con escenario (${retiradas} retiradas)`)
}
```
Agregar al lado `scripts/verificar-specs.d.mts` para que TypeScript conozca el tipo:
```ts
export function verificarSpecs(directorioSpecs: string): { reglas: number; retiradas: number; errores: string[] }
```

- [ ] **Paso 4: arnés de aceptación** — un archivo por feature, con registro todavía vacío (la Ola 4 agrega los pasos). Ejemplo `tests/aceptacion/catalogo.feature.spec.ts`:

```ts
import { fileURLToPath } from 'node:url'
import { ejecutarFeature } from '../gherkin/ejecutar-feature'
import { RegistroDePasos } from '../gherkin/registro-de-pasos'

const RUTA = fileURLToPath(new URL('../../../docs/specs/fase-1/features/catalogo.feature', import.meta.url))

// Los pasos se agregan en la Ola 4 (feat/aceptacion). Mientras tanto todos los escenarios quedan pendientes.
ejecutarFeature(RUTA, new RegistroDePasos<object>(), () => ({}))
```
Crear los otros cuatro igual, cambiando el nombre del `.feature` (`operaciones`, `alertas`, `torre-de-control`, `respaldo`).

- [ ] **Paso 5:** `npm run verificar-specs` → `✓ 68 reglas vigentes con escenario (2 retiradas)`. `npx vitest run` → todo en verde, con los 104 escenarios reales como pendientes (comprueba que los cinco `.feature` se parsean).
- [ ] **Paso 6:** `npm run lint:ci && npm run type-check` → PASS.
- [ ] **Paso 7:** commit `test(specs): verificación de reglas y arnés de aceptación de las features`.

---

## Autorrevisión del plan

- Cobertura: RN-SIS-01 (Tarea 10), RN-SIS-02 (umbrales, Tarea 1), RN-SIS-03 (no-explicit-any y lint:ci, Tarea 1), RN-SIS-04 (fronteras, Tarea 1). Base para RN-OP-04/12, RN-CAT-01, RN-AN-06 (objetos de valor).
- Los tipos que usan las olas siguientes están todos en la Tarea 8 o en `shared/domain`.
