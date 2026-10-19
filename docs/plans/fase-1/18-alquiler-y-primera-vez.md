# Plan 18 — Alquiler del local y primera vez obligatoria (v0.2.0)

> **Para agentes:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Leer [00-plan-maestro.md](00-plan-maestro.md), [07-calidad.md](../../specs/fase-1/07-calidad.md) y [ADR-0010](../../adr/0010-versiones-y-publicacion.md). Las dos ramas corren **en paralelo** y salen de `docs/spec-local-y-recorrido` (la spec aprobada), **no** de `develop`.

**Objetivo:** Control muestra si lo ganado cubre el alquiler del local y la app lo recuerda antes de cada pago; la primera vez es obligatoria y permite restaurar una copia. Se publica como **v0.2.0**.

**Spec:** RN-AN-17 a RN-AN-19 ([04](../../specs/fase-1/04-torre-de-control.md)), RN-AL-10 y RN-AL-11 ([03](../../specs/fase-1/03-alertas.md)), RN-RE-10 y RN-RE-11 ([05](../../specs/fase-1/05-respaldo-e-importacion.md)), RN-UX-16 y "Primera vez" ([06](../../specs/fase-1/06-experiencia-de-uso.md)). Escenarios en `docs/specs/fase-1/features/*.feature` (ya escritos).

**Stack:** Vue 3 + TypeScript, Pinia, vue-router, Dexie, Vitest (jsdom), Playwright, runner Gherkin propio (`frontend/tests/gherkin/`).

## Restricciones globales

- Dinero en céntimos enteros con `Dinero` (`src/shared/domain/dinero.ts`); en pantalla siempre `formatearDinero` ("S/ 1 200.00", "-S/ 24.00").
- Días como `Dia` "AAAA-MM-DD" (`src/shared/domain/fecha.ts`), zona de la tienda UTC−5; "hoy" sale del puerto `Reloj`, nunca de `new Date()` en dominio/aplicación.
- Textos exactos de la spec, en "tú". Guía de palabras de 06 (nada de "merma", "backup"…).
- RN-UX-02/06/09: botones ≥ 48 px (principal ≥ 56 px), − / + en montos, sin scroll horizontal de 320 a 1920 px con letra Muy grande.
- Cada regla nueva con su test unitario y su escenario Gherkin en verde con `GHERKIN_ESTRICTO=1`.
- Vitest y Playwright con 2 workers; Playwright en un **puerto propio por worktree**. Verificar el **código de salida** de cada comando, no solo el resumen.
- Commits en español (Conventional Commits) con el trailer `Co-Authored-By`.
- Cada PR que cambia algo visible agrega su línea en `## Sin publicar` de `CHANGELOG.md` (en palabras de la tienda).

## Integración (por qué no hay PR por rama)

El CI corre el Gherkin **estricto** en `develop`: un escenario sin pasos falla. La spec trae escenarios de las dos ramas, así que ninguna puede entrar sola a `develop`. Por eso:

1. Rama A `feat/alquiler-del-local` y rama B `feat/primera-vez-obligatoria` salen de `docs/spec-local-y-recorrido`, en worktrees propios.
2. Cada rama se cierra con implementador + revisor independiente. Se verifica con Gherkin **no estricto** (los escenarios de la otra rama quedan pendientes) más un chequeo de que **sus** escenarios no queden pendientes.
3. A y B se integran con `merge --no-ff` en `docs/spec-local-y-recorrido`, que se renombra `feat/alquiler-y-primera-vez`. Ahí: verificación completa estricta, push y **un solo PR a `develop`** con los 4 checks en verde.
4. Entrega v0.2.0 (Tarea 9).

Archivos que tocan las dos ramas, donde se esperan conflictos triviales al integrar: `tests/aceptacion/vocabulario.spec.ts` (conteo de escenarios), `docs/specs/fase-1/features/respaldo.feature` (no se edita, solo se implementa), `e2e/utilidades/pantallas-de-la-app.ts` y `CHANGELOG.md`. Al integrar, se recuentan los totales.

---

# Rama A — `feat/alquiler-del-local`

### Tarea 1: Configuración del local (tienda) y fechas de pago (dominio compartido)

**Archivos:**
- Modificar: `src/shared/contratos/configuracion.ts` (tipo + valor inicial + campos del estado del sistema)
- Crear: `src/shared/domain/fechas-de-pago.ts` y `src/shared/domain/fechas-de-pago.spec.ts`
- Modificar: `src/modules/tienda/domain/configuracion.ts` (`validarCambios` valida el alquiler) y su spec
- Modificar: `src/modules/tienda/application/casos.ts` (`obtenerConfiguracion` mezcla con `CONFIGURACION_INICIAL`; `estadoDelSistema` crea los campos nuevos en `null`) y sus specs
- Modificar: contrato de repositorio `src/modules/tienda/infrastructure/__pruebas__/contrato-de-repositorio.ts` (guarda y lee el alquiler)

**Interfaces que produce:**

```ts
// src/shared/contratos/configuracion.ts
export type AlquilerDelLocal =
  | { tipo: 'NO_PAGA' }
  | { tipo: 'MENSUAL'; montoCentimos: number; dias: [number] }
  | { tipo: 'QUINCENAL'; montoCentimos: number; dias: [number, number] } // ordenados, distintos

export interface ConfiguracionDeNegocio {
  // …los 6 campos actuales…
  alquilerDelLocal: AlquilerDelLocal | null // null = sin configurar
}
// CONFIGURACION_INICIAL.alquilerDelLocal = null
export const MONTO_MAXIMO_DEL_ALQUILER_CENTIMOS = 9_999_999

export interface EstadoDelSistema {
  // …campos actuales…
  ultimoPagoDelLocalAvisado: string | null      // Dia (RN-AL-11)
  recordatorioDelLocalCerradoEl: string | null  // Dia (RN-AL-10)
}
```

```ts
// src/shared/domain/fechas-de-pago.ts — RN-AN-18 (puro)
import type { Dia } from './fecha'

const dos = (n: number) => String(n).padStart(2, '0')
const diasDelMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate()

/** El día elegido en ese mes, o el último día si el mes no lo tiene (31 → 28/02). */
export function fechaDePagoEn(anio: number, mes: number, dia: number): Dia {
  return `${anio}-${dos(mes)}-${dos(Math.min(dia, diasDelMes(anio, mes)))}`
}

/** Fechas de pago del mes anterior, el actual y el siguiente, ordenadas. Con días ≤ 31 alcanza. */
function fechasAlrededor(dias: readonly number[], hoy: Dia): Dia[] {
  const [anio, mes] = hoy.split('-').map(Number) as [number, number]
  const meses: [number, number][] = [-1, 0, 1].map((d) => {
    const m = mes + d
    return m < 1 ? [anio - 1, 12] : m > 12 ? [anio + 1, 1] : [anio, m]
  })
  return meses.flatMap(([a, m]) => dias.map((d) => fechaDePagoEn(a, m, d))).sort()
}

export function ultimoPago(dias: readonly number[], hoy: Dia): Dia {
  return fechasAlrededor(dias, hoy).filter((f) => f <= hoy).at(-1)!
}
export function proximoPago(dias: readonly number[], hoy: Dia): Dia {
  return fechasAlrededor(dias, hoy).find((f) => f > hoy)!
}
/** La siguiente fecha de pago igual o posterior a hoy (RN-AL-10). */
export function siguientePagoDesde(dias: readonly number[], hoy: Dia): Dia {
  return fechasAlrededor(dias, hoy).find((f) => f >= hoy)!
}
```

**Validación** (en `validarCambios`, solo si `alquilerDelLocal` viene en los cambios y no es `null` ni `NO_PAGA`). Mensajes exactos de `torre-de-control.feature`:
- `montoCentimos` ≤ 0 → `El monto debe ser mayor que S/ 0.00`; mayor que el máximo → `El monto no puede pasar de S/ 99 999.99`.
- Cada día entero de 1 a 31, si no → `El día de pago va del 1 al 31`.
- `QUINCENAL` con días iguales → `Elige dos días distintos`. Al guardar, los días se ordenan.
- El texto con más de 2 decimales (`El monto puede tener hasta 2 decimales`) se valida en la pantalla al convertir con `Dinero.deTexto`: traducir su error `DINERO_DECIMALES` a ese mensaje.

**Pruebas (escribir primero, ver en rojo):**
- `fechas-de-pago.spec.ts`: las 5 filas del esquema RN-AN-18 de la feature, más el cruce de año (hoy 2026-12-25, días [5, 20] → último 2026-12-20, próximo 2027-01-05), febrero bisiesto (2028-02-10, día 30 → próximo 2028-02-29) y `siguientePagoDesde` en el mismo día de pago (devuelve hoy).
- `configuracion.spec.ts`: cada mensaje de arriba; `NO_PAGA` y `null` son válidos.
- `casos.spec.ts`: un registro guardado **sin** `alquilerDelLocal` se lee con `alquilerDelLocal: null` (mezcla con valores iniciales); el estado del sistema nuevo trae los dos campos en `null`.

Commit: `feat(tienda): costo del local en la configuración y fechas de pago (RN-AN-17, RN-AN-18)`

### Tarea 2: Avance del alquiler en Control (análisis + pasos Gherkin RN-AN-17/18/19)

**Archivos:**
- Crear: `src/modules/analisis/domain/alquiler.ts` y su `.spec.ts`
- Modificar: `src/modules/analisis/application/torre.ts` (`TorreDeControl` gana `alquiler`) y su spec
- Modificar: `src/modules/analisis/application/modulo.ts` (las dependencias leen la configuración de tienda; ver cómo `situaciones.ts` obtiene `hoyDe(d)`)
- Modificar: `tests/aceptacion/pasos/torre.ts` (y `contexto.ts` si los pasos de configuración del local se comparten con alertas), `tests/aceptacion/vocabulario.spec.ts` (totales)

**Interfaces que produce:**

```ts
// src/modules/analisis/domain/alquiler.ts — RN-AN-19 (puro)
export interface AvanceDelAlquiler {
  proximoPago: Dia
  monto: Dinero
  llevas: Dinero        // ganancia neta del periodo [ultimoPago, hoy]
  cubierto: boolean     // llevas >= monto
  porcentaje: number    // cubierto ? 100 : max(0, floor(llevas × 100 ÷ monto)), en céntimos enteros
}
export function avanceDelAlquiler(monto: Dinero, llevas: Dinero, proximoPago: Dia): AvanceDelAlquiler
/** Las dos líneas de la tarjeta, exactas de la spec (DD/MM con formatearDia o un helper nuevo). */
export function textosDelAlquiler(avance: AvanceDelAlquiler): [string, string]
//  no cubierto: ["Para el pago del 20/10 llevas S/ 110.00 de S/ 600.00", "Te falta S/ 490.00"]
//  cubierto:    ["✓ Ya cubriste el local del 20/10", "Lo que ganes de más es tuyo: llevas S/ 10.00"]

// src/modules/analisis/application/torre.ts
export type AlquilerEnControl =
  | { estado: 'SIN_CONFIGURAR' }
  | { estado: 'NO_PAGA' }
  | { estado: 'CON_PAGO'; avance: AvanceDelAlquiler; textos: [string, string] }
// TorreDeControl.alquiler: AlquilerEnControl
```

`llevas` = `resumenDePeriodo(filas, { desde: ultimoPago(dias, hoy), hasta: hoy }).gananciaNeta`, con las filas de `d.resumenes.entre(desde, hasta)` mapeadas como en `filasEntre` (`application/modulo.ts`). No depende del periodo elegido en el Resumen.

**Pruebas:**
- `alquiler.spec.ts`: 110/600 → 18 %; 610/600 → cubierto, 100 %, "llevas S/ 10.00"; exactamente 600/600 → cubierto, "llevas S/ 0.00"; −24/600 → 0 % y "Te falta S/ 624.00".
- `torre.spec.ts`: sin configurar, `NO_PAGA` y con pago (ventas antes del último pago **no** cuentan).
- Gherkin: implementar los pasos de los escenarios `@RN-AN-17`, `@RN-AN-18` y `@RN-AN-19` de `torre-de-control.feature`. "configuro el local con pago …, monto … y días …" usa `tienda.actualizarConfiguracion` (el monto pasa por `Dinero.deTexto`, que da el error de decimales); "la tarjeta del alquiler dice" compara contra `textos`; "la barra del alquiler está en" contra `porcentaje`; "no se muestra la tarjeta del alquiler" ⇔ `NO_PAGA`. Actualizar los totales de `vocabulario.spec.ts`.

Commit: `feat(analisis): avance del alquiler del local en Control (RN-AN-19)`

### Tarea 3: Tarjeta y pantalla "Alquiler del local" (UI)

**Archivos:**
- Crear: `src/shared/ui/componentes/SelectorDeDia.vue` (+ test en el estilo de los demás componentes): `<select>` nativo con `<label>`, opciones 1 a 31, alto ≥ 56 px, letra heredada, `v-model: number | null`, prop `error?`.
- Crear: `src/modules/analisis/ui/VistaAlquilerDelLocal.vue` (+ test de pantalla). Ruta `/control/alquiler`, nombre `alquiler-del-local`, `meta.titulo: 'Alquiler del local'`, en `src/router/rutas/control.ts`.
  - `BotonesDeOpcion` con *Una vez al mes* · *Dos veces al mes* · *No pago, el local es mío*.
  - Si paga: `CampoNumero` "¿Cuánto pagas cada vez? (S/)" con `decimales` y `paso` 10, y uno o dos `SelectorDeDia` ("¿Qué día pagas?" / "Primer día de pago" y "Segundo día de pago").
  - `BotonPrincipal` *Guardar* → `tienda.actualizarConfiguracion({ alquilerDelLocal })` → `PantallaExito` "Listo, guardamos el alquiler del local" con *Volver*, que vuelve a la pantalla de origen (`?desde=ajustes` → `datos-de-la-tienda`, si no → `control`).
  - Errores de dominio con `MensajeDeError` junto al campo.
  - Al abrir, se precarga la configuración actual.
- Modificar: `src/modules/analisis/ui/VistaControl.vue`: nueva `SeccionDeControl` "Alquiler del local" (ícono de casa/llave de lucide) como **segunda** sección de la columna 1, después de Resumen.
  - `CON_PAGO`: las dos líneas, `BarraDeProgreso` (`actual` = porcentaje, `total` = 100, `texto` = "N %") y enlace *Cambiar*.
  - `SIN_CONFIGURAR`: "¿Pagas alquiler por tu local?" y botón *Configurar*.
  - `NO_PAGA`: la sección no se renderiza.
- Modificar: `src/modules/tienda/ui/VistaDatosDeLaTienda.vue`: `EnlaceDeAjuste` "Alquiler del local" (detalle: "S/ 600.00 · días 5 y 20", "No pagas alquiler" o "Sin configurar") hacia `alquiler-del-local?desde=ajustes`.
- Modificar: `src/modules/analisis/ui/__tests__/vista-control.spec.ts` (hoy espera exactamente 7 títulos: pasan a 8 con un local configurado y a 7 con `NO_PAGA`).
- Modificar: `e2e/utilidades/pantallas-de-la-app.ts` (la ruta nueva; `tests/configuracion/cobertura-del-barrido.spec.ts` lo exige) y un E2E `e2e/alquiler-del-local.spec.ts`: configurar desde Control, ver la tarjeta con una venta sembrada y cambiar a *No pago* → la tarjeta desaparece.

**Pruebas de pantalla:** guardar mensual y quincenal; los dos días iguales muestran "Elige dos días distintos"; un monto "12.345" muestra "El monto puede tener hasta 2 decimales"; con *No pago* se ocultan monto y días; el `<select>` tiene nombre accesible.

Commit: `feat(analisis): tarjeta y pantalla del alquiler del local`

### Tarea 4: Recordatorio y notificación del pago (alertas)

**Archivos:**
- Crear: `src/modules/alertas/domain/recordatorio-del-local.ts` y su `.spec.ts`
- Modificar: `src/modules/alertas/application/modulo.ts` (dependencia `tienda` ya existe: leer `configuracion()` y el estado del sistema), `application/resumen.ts` (el resumen del día agrega la línea), `application/evaluar-avisos.ts` (notificación RN-AL-11)
- Crear: casos `recordatorioDelLocal()` y `cerrarRecordatorioDelLocal()` en alertas (patrón de `resumenDelDia` / `cerrarResumenDelDia`)
- Modificar: `src/app/abrir-app.ts` (`InicioDeLaApp.recordatorioDelLocal: string | null`, paso accesorio con `sinDetenerse`), `src/app/estado-global.ts` (campo y acción `cerrarRecordatorioDelLocal`), `src/modules/tienda/ui/VistaInicio.vue` (`AvisoEnPagina tono="info"` con el texto y `textoCerrar="Entendido"`, en `.extras`)
- Modificar: `tests/aceptacion/pasos/alertas.ts` y `vocabulario.spec.ts`

**Interfaces:**

```ts
// src/modules/alertas/domain/recordatorio-del-local.ts — RN-AL-10 (puro)
export interface RecordatorioDelLocal { fechaDePago: Dia; texto: string }
/** null si no hay pago configurado o la siguiente fecha (siguientePagoDesde) está a más de 2 días. */
export function recordatorioDelLocal(alquiler: AlquilerDelLocal | null, hoy: Dia): RecordatorioDelLocal | null
// 0 días → "Hoy pagas el local: S/ 1 200.00"; 1 → "Mañana pagas…"; 2 → "Pasado mañana pagas…"
export const RUTA_DEL_ALQUILER = '/control'
```

Reglas de aplicación:
- `recordatorioDelLocal()` devuelve `null` también si `estado.recordatorioDelLocalCerradoEl === hoy`. `cerrarRecordatorioDelLocal()` guarda hoy en ese campo.
- El resumen del día agrega `texto` como última línea cuando hay recordatorio. **No** depende del cierre del recordatorio de Inicio.
- En `evaluarAvisos`, si hay recordatorio, `fechaDePago !== estado.ultimoPagoDelLocalAvisado` y `notificacionesPermitidas(d)`: `notificador.mostrar({ texto, url: RUTA_DEL_ALQUILER })` en `uow.alConfirmar` y se guarda `ultimoPagoDelLocalAvisado = fechaDePago`. Es una notificación propia, nunca agrupada con las de stock (su `url`/tag es distinto).
- Sin permiso no se marca como avisada (así se avisa si después se da el permiso dentro de la ventana).

**Pruebas:**
- Dominio: los 3 textos; día 17 con pago el 20 → `null`; `NO_PAGA` y `null` → `null`; pago el 31 en febrero (hoy 26/02/2027 → "Pasado mañana", fecha 28/02).
- Aplicación: cerrar oculta hasta el día siguiente; una sola notificación por fecha; cambiar el día a otra fecha dentro de la ventana avisa de nuevo; sin permiso no notifica ni marca.
- Pantalla de Inicio (`tests/pantallas/inicio.spec.ts`): se muestra y *Entendido* lo cierra con el foco en el h1 (patrón `despuesDeCerrar`).
- Gherkin: escenarios `@RN-AL-10` y `@RN-AL-11` de `alertas.feature` ("pasa un día" avanza el `RelojFijo` 24 h; "Inicio muestra" y "Inicio no muestra el recordatorio del local" usan `abrirApp`).

Commit: `feat(alertas): recordatorio y notificación del pago del local (RN-AL-10, RN-AL-11)`

### Tarea 5: Formato de respaldo 2 (respaldo)

**Archivos:**
- Modificar: `src/modules/respaldo/domain/formato-de-respaldo.ts`
  - `VERSION_DE_FORMATO = 2`; `RespaldoV2` reemplaza a `RespaldoV1` como tipo leído.
  - `migrar`: v1 → v2 agrega `datos.configuracion.alquilerDelLocal = null`.
  - `configuracionValida` acepta `alquilerDelLocal` `null` o con la forma de `AlquilerDelLocal`.
  - `invariantesDelLibro` valida monto y días con las reglas de la Tarea 1 (reusar `validarCambios`, o una función pura compartida exportada desde `shared`, sin importar de otro módulo).
- Modificar: `src/modules/respaldo/infrastructure/dexie/almacen-de-respaldo.ts` y `infrastructure/memoria/almacen-de-respaldo.ts` (`registroDeNegocio` copia `alquilerDelLocal`; hoy lo perdería).
- Modificar: specs que fijan la versión (`formato-de-respaldo.spec.ts`, `formato-de-respaldo-estricto.spec.ts`, `copia.spec.ts`): "más nueva" pasa a ser la 3.
- Modificar: `tests/aceptacion/pasos/respaldo.ts` (escenarios `@RN-RE-11` y `@RN-RE-05` con versión "3").

**Pruebas:** una copia v1 real (fixture existente) se restaura con `alquilerDelLocal: null`; ida y vuelta guardar → restaurar conserva el `QUINCENAL` de 600 con días [5, 20]; una copia v2 con `dias: [5, 5]` o monto 0 se rechaza como inválida sin tocar los datos.

Commit: `feat(respaldo): formato 2 con el costo del local (RN-RE-11)`

**Cierre de la rama A:** `npm run lint:ci`, `npm run type-check`, `npm run test:cobertura` (umbrales), `npm run verificar-specs`, `npm run build`, `npm run test:e2e` (puerto propio). Revisor independiente (spec + calidad) y rondas de corrección. Línea de CHANGELOG en "Sin publicar → Nuevo": "Control muestra si lo que llevas ganado ya cubre el alquiler del local, y la app te recuerda el pago dos días antes."

---

# Rama B — `feat/primera-vez-obligatoria`

### Tarea 6: Primera vez en 5 pasos que se completa al final

**Archivos:**
- Modificar: `src/modules/tienda/ui/VistaPrimeraVez.vue`
  - Paso 3 (letra): guarda nombre y letra con `tienda.actualizarConfiguracion({ nombreTienda, tamanoDeLetra })` y **no** completa.
  - Paso 4: *Uno por uno* · *Desde Excel* · ***Más tarde*** (antes "Dejar para después"), que va al paso 5.
  - Paso 5: *Contar ahora* solo si hay productos activos (consultar al catálogo), y *Terminar*. Con productos y sin contar, muestra "Puedes contarlos después desde Inicio". Los dos llaman `tienda.completarPrimeraVez({ nombreTienda, tamanoDeLetra })` (la firma se mantiene: los E2E y `estado-global` la usan), luego `estadoGlobal.recargarConfiguracion()`, y van a `contar-todo` o a `inicio` con `replace`.
  - Paso 1: botón secundario *Ya tengo una copia guardada* → `restaurar-copia` con `query: { desde: 'primera-vez' }`.
  - La barra de progreso sigue en "Paso N de 5".
- Modificar: `tests/pantallas/primera-vez.spec.ts` y `src/app/__tests__/estado-global.spec.ts` (`primeraVez` sigue `true` después del paso 3 y pasa a `false` al terminar el 5).

**Pruebas:** tras el paso 3 la configuración tiene nombre y letra y `primeraVezCompletada` sigue en `false`; sin productos, el paso 5 no ofrece *Contar ahora*; *Terminar* completa y abre Inicio; recargar en el paso 4 conserva el nombre prellenado.

Commit: `feat(tienda): la primera vez se completa en el paso 5 (RN-UX-16)`

### Tarea 7: Guardia global, sin navegación y restaurar desde la bienvenida

**Archivos:**
- Modificar: `src/router/index.ts`: `router.beforeEach` global. Si falta la primera vez (misma función `faltaLaPrimeraVez`, movida a un lugar común, sin Pinia activa no redirige) y `to.name` no está en `PERMITIDAS_EN_LA_PRIMERA_VEZ = ['primera-vez', 'restaurar-copia', 'producto-nuevo', 'importar-productos']`, redirige a `{ name: 'primera-vez' }`. Quitar el `beforeEnter` de `inicio`, que queda cubierto, y mantener el de `primera-vez`.
- Modificar: `src/app/LayoutApp.vue`: `BarraNavegacion` con `v-if="!estadoGlobal.primeraVez"`. Comprobar que `--alto-pie` queda bien sin la barra (el `min-height` de `VistaPrimeraVez`).
- Modificar: la restauración marca la primera vez como completada (RN-RE-10). En el caso de uso `restaurarCopia` de respaldo, después de confirmar, `tienda.actualizarEstadoDelSistema({ primeraVezCompletada: true })` (el almacén de respaldo "nunca pisa 'sistema'", así que no lo hace solo). `estado-global` ya recarga con `alCambiarEnBloque`.
- Modificar: `src/modules/respaldo/ui/VistaRestaurarCopia.vue`. Con `desde=primera-vez`: *Volver* y *Cancelar* regresan a la bienvenida; el éxito dice "Copia restaurada" con *Ir al inicio*.
- Modificar: `src/modules/inventario/ui/VistaContarTodo.vue`. Su estado vacío ya no puede mandar a `producto-nuevo` durante la primera vez (no pasa, porque el paso 5 no ofrece contar sin productos); solo verificar que no hay camino de escape.
- Modificar: `tests/aceptacion/pasos/respaldo.ts` (escenarios `@RN-RE-10`: "elijo … en la bienvenida" y "se muestra la bienvenida" se resuelven a nivel de aplicación con el estado `primeraVezCompletada`; "cancelo la restauración" no restaura nada) y `vocabulario.spec.ts`.
- Pruebas de router en `src/router/__tests__/`: con la primera vez pendiente, `/vender`, `/control`, `/ajustes` y una ruta inexistente terminan en `/bienvenida`; `/ajustes/restaurar` y `/productos/nuevo` se permiten; ya completada no se redirige nada.

Commit: `feat(app): primera vez obligatoria y restaurar desde la bienvenida (RN-UX-16, RN-RE-10)`

### Tarea 8: E2E con la primera vez obligatoria

**Archivos:**
- Crear o mover en `e2e/utilidades/tienda.ts`: `completarPrimeraVez(page, nombre = 'Bodega Rosita')`, que abre `./`, espera la bienvenida montada y llama `window.__aplicacion.tienda.completarPrimeraVez` en `page.evaluate`.
  - `abrirTiendaLista` y `prepararTienda` (`e2e/utilidades/control.ts`) lo usan. Hoy abren `./ajustes` primero, que con la guardia termina en la bienvenida; funciona igual, pero se deja explícito.
- Modificar las suites que abren pantallas sin completar la primera vez para que lo hagan en su `beforeEach`: `productos.spec.ts`, `operaciones.spec.ts`, `pie-y-aviso.spec.ts`, `grafico.spec.ts`, `encabezado-y-boton-principal.spec.ts`, `kit-paneles.spec.ts`, `kit-productos.spec.ts`. Buscar más con `grep -L "completarPrimeraVez\|abrirTiendaLista\|prepararTienda\|hacerPrimeraVez" e2e/*.spec.ts` y revisar cada una.
- Modificar: `e2e/utilidades/recorridos.ts` (`hacerPrimeraVez*`: paso 4 *Más tarde* → paso 5 *Terminar* → "Hola, …"), `e2e/recorridos/primera-vez.spec.ts`, `e2e/inicio-y-ajustes.spec.ts` y `e2e/recorridos/copia.spec.ts` (nuevo recorrido: perfil nuevo → bienvenida → *Ya tengo una copia guardada* → restaurar → Inicio con los datos, **sin** pasar por el recorrido).
- Nuevo E2E: con la primera vez pendiente, la barra de navegación no existe y `./vender` muestra la bienvenida.
- `e2e/recorridos/barrido.spec.ts`: `PANTALLAS_DE_LA_PRIMERA_VEZ` incluye el paso 5 con y sin productos y la bienvenida con su botón nuevo.

**Cierre de la rama B:** la misma verificación completa que la rama A, revisor independiente y CHANGELOG ("Cambiado": "La primera vez que abres la app te guía paso a paso y no te deja salir hasta terminar." · "Nuevo": "Si cambias de celular, puedes restaurar tu copia desde la bienvenida.").

---

# Tarea 9: Integración y entrega v0.2.0 (ADR-0010)

1. En `docs/spec-local-y-recorrido`: `merge --no-ff` de A y luego de B. Resolver los conflictos de las listas compartidas y recontar `vocabulario.spec.ts`.
2. Verificación completa con `GHERKIN_ESTRICTO=1`. Ningún escenario pendiente y código de salida 0 en todo.
3. Renombrar la rama a `feat/alquiler-y-primera-vez`, hacer push, `gh pr create --base develop`, `gh pr checks --watch` y `gh pr merge --merge`.
4. `release/v0.2.0` desde `develop`: `npm version 0.2.0 --no-git-tag-version` en `frontend/` y CHANGELOG "Sin publicar" → `## [0.2.0] · AAAA-MM-DD` con su enlace. Commit `release: v0.2.0`, PR a `develop` y merge.
5. PR `develop` → `main` titulado `release: v0.2.0`, con los 4 checks en verde y merge.
6. `git tag -a v0.2.0 <merge de main> -m "v0.2.0"`, `git push origin v0.2.0` y `gh release create v0.2.0 --title "v0.2.0" --notes-file <notas de 0.2.0>`.
7. Verificar Pages: abre, *Acerca de* dice 0.2.0 y funciona sin internet.
