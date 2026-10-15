# Ola 2 — Convenciones comunes de los módulos (planes 04 a 08)

> Leer junto con [00-plan-maestro.md](00-plan-maestro.md). Aplica a `feat/catalogo`, `feat/inventario`, `feat/analisis`, `feat/alertas` y `feat/respaldo-tienda`, que se desarrollan **en paralelo**.

## Tarea 0 (antes de lanzar la ola, en `develop`): ajustes de contrato

Rama `chore/contratos-ola-2`. Cambios en `frontend/src/shared/contratos/entre-modulos.ts`:

```ts
/** Error de validación con código, para que Respaldo redacte el mensaje de importación (RN-RE-08). */
export interface ErrorDeValidacion {
  codigo: string
  mensaje: string
  /** Solo en NOMBRE_DUPLICADO: el nombre tal como está guardado. */
  nombreExistente?: string
}

// En CatalogoParaImportacion, reemplazar la firma de validarNuevo por:
validarNuevo(datos: DatosDeProductoNuevo): Promise<ErrorDeValidacion | null>

/** Totales de la tienda en un día (RN-AN-02). */
export interface TotalesDeDia {
  dia: Dia
  ventas: Dinero
  costoVendido: Dinero
  gananciaBruta: Dinero
  mermas: Dinero
  gananciaNeta: Dinero
  diferenciasDeConteo: Dinero
}

// En AnalisisConsultable, reemplazar totalesDelDia y agregar resumenesDeTienda:
totalesDelDia(dia: Dia): Promise<TotalesDeDia>
/** Días con alguna venta, merma o ajuste, en orden ascendente. */
resumenesDeTienda(desde: Dia, hasta: Dia): Promise<TotalesDeDia[]>
```
Verificación: `npm run type-check && npx vitest run`. Commit `refactor(contratos): errores de validación con código y totales por día`. Merge `--no-ff` a `develop`.

## Estructura de cada módulo

```
src/modules/<modulo>/
├─ domain/                 entidades, objetos de valor, reglas puras (+ *.spec.ts)
├─ application/
│  ├─ puertos.ts           repositorios y servicios que el módulo necesita
│  ├─ <caso-de-uso>.ts     un archivo por caso de uso o grupo pequeño (+ *.spec.ts)
│  └─ modulo.ts            crearModulo<X>(dependencias): Modulo<X>
├─ infrastructure/
│  └─ memoria/             repositorios sobre AlmacenEnMemoria (+ *.spec.ts)
└─ index.ts                API pública: crearModulo<X>, tipos públicos, repos en memoria
```

- **Dependencias entre módulos** se reciben como **funciones perezosas** para permitir referencias cruzadas en la composición: `inventario: () => InventarioParaCatalogo`. Nunca importar otro módulo (solo `@/shared/**`).
- **Unidad de trabajo:** todo caso de uso que escribe usa `uow.ejecutar(async () => { … })`. Los **eventos se publican después** de que `ejecutar` termina bien.
- **Mensajes:** los textos de error (`ErrorDeDominio`) y de respuesta son **exactamente** los de la spec y los `.feature`. Montos y cantidades siempre con `@/shared/domain/formato`.
- **Repositorios en memoria** guardan y devuelven **registros** (`@/shared/contratos/registros`) usando `AlmacenEnMemoria`; el dominio convierte con `desdeRegistro` / `aRegistro`.
- **Tests:** cada regla tiene tests unitarios cuyo nombre empieza con su id (`RN-CAT-05: …`), usando repositorios en memoria y dobles simples de los otros módulos. Los escenarios Gherkin se conectan en la Ola 4; aquí se cubren las mismas reglas con tests unitarios y de casos de uso, **usando los mismos datos de ejemplo de los `.feature`**.
- **Cobertura:** `domain` ≥ 95 %, `application` ≥ 90 % (`npm run test:cobertura`).
- **No tocar** archivos de otros módulos, `src/shared/**` (salvo indicación del plan), `src/app/**`, `src/router/**`, `tests/aceptacion/**`.
- Verificación final de cada rama: `npm run lint:ci && npm run type-check && npm run test:cobertura && npm run build-only && npm run verificar-specs`.
