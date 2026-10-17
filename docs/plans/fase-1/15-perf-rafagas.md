# Plan 15 — `perf/rafagas`: ventas seguidas rápidas en un celular lento

> **Para agentes:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (o executing-plans). Leer [00-plan-maestro.md](00-plan-maestro.md), [09-composicion-dexie.md](09-composicion-dexie.md) y [07-calidad.md](../../specs/fase-1/07-calidad.md). Se desarrolla **en paralelo** con los kits y la Ola 4, sobre la composición (rama C).

**Objetivo:** cumplir **RN-SIS-09** también en ráfaga. Con datos realistas (300 productos, 50 000 movimientos) y CPU ×4:
- una venta se confirma en **menos de 300 ms** aunque llegue justo después de otra;
- la Torre de control sigue cargando en **menos de 1 s**;
- la primera carga de la app es más liviana.

**Sin cambio de comportamiento.** Las reglas de negocio, los textos y los resultados no cambian. Toda la suite (unitarias, integración memoria = Dexie, aceptación, E2E) sigue en verde. Si algo pide cambiar la spec, se detiene y se reporta.

## Punto de partida (medido en la rama C)

| Escenario | Medición | Meta |
|---|---|---|
| Torre de control | 71–394 ms | < 1 s ✅ |
| Venta en calma | 5–55 ms | < 300 ms ✅ |
| Venta justo después de otra, CPU ×1 | 144–226 ms | < 300 ms ✅ |
| Venta justo después de otra, CPU ×4 | **682–1174 ms** | < 300 ms ❌ |

Causas encontradas:
- `ejecutar` abre una transacción `'rw'` sobre **todas** las tablas.
- Las lecturas de Análisis y `estadoDelSistema` también corren en `'rw'`, así que hacen fila detrás de las escrituras.
- Cada operación dispara **dos** `situaciones()`: la de la re-evaluación de avisos y la del contador de Pinia.
- Cada `situaciones()` hace unos 300 `primerDiaDe`, uno por producto.

Bundle: el chunk de entrada pesa 415 KB (134.4 KB gzip). Las librerías de Excel se importan de forma estática.

## Tareas

### Tarea 1 — Medir antes de tocar (y dejar la medición como prueba)
- Agregar un escenario de **ráfaga** al rendimiento de integración (Dexie, `tests/integracion/rendimiento.spec.ts`): 10 ventas seguidas, cada una esperada, sobre 300 productos / 50 000 movimientos. Se reportan la mediana y el peor caso de "confirmar venta" (hasta que `ejecutar` resuelve).
- Agregar el mismo escenario al E2E opcional `e2e/rendimiento.spec.ts`, con CPU ×4 (CDP `Emulation.setCPUThrottlingRate`).
- Mantener el patrón actual: con un límite holgado, para que el CI no sea inestable (RN-SIS-09 se verifica con la medición opcional), o con el mismo mecanismo que ya usa la rama C.
- Anotar los números de partida en el informe.

### Tarea 2 — Lecturas en transacción de solo lectura
- Agregar `leer<T>(fn)` a la `UnidadDeTrabajo` (`shared/application/unidad-de-trabajo.ts`) con su contrato en JSDoc:
  - En Dexie: transacción `'r'` sobre las tablas que se leen (o todas).
  - Dentro de un `ejecutar` ya abierto, **se une** a esa transacción y no abre otra.
  - No acepta `alConfirmar`; registrar una acción ahí es un error de programación y lanza.
- Implementarla en memoria y en Dexie. Probarla en las **dos** suites de contrato (`__pruebas__`), incluidos el anidamiento dentro de `ejecutar` y la concurrencia: una lectura no espera a una escritura en curso en otra transacción, o lo hace sin bloquear la fila.
- Usar `leer` en los casos de uso de solo lectura: consultas de Análisis (situaciones, torre, para comprar, ¿necesito comprar?), `estadoDelSistema`, listados de Catálogo e historial. El ESLint de fronteras debe seguir limpio.

### Tarea 3 — `primerDiaDe` en lote
- Cambiar las ~300 llamadas por producto por **una** consulta que devuelve `Map<productoId, Dia>`, por ejemplo `primerosDias(productoIds?)` en el contrato `ProyeccionDeOperaciones` / `InventarioConsultable`, implementada en memoria y en Dexie.
- Semántica idéntica a la actual, incluida la regla vigente sobre filas de anulación del mismo día. Probarlo con una prueba de paridad contra la implementación anterior, sobre datos con anulaciones, productos sin movimientos y productos archivados.

### Tarea 4 — Re-evaluar una sola vez y compartir el resultado
- Tras una operación, Alertas (re-evaluación de avisos) y el estado global (contador) deben usar **un solo** cálculo de `situaciones()`.
- Coalescer las re-evaluaciones que llegan en ráfaga en una sola, con una ventana corta y configurable (valor inicial ~300 ms; inyectable para pruebas).
- Requisitos que no pueden romperse:
  - `esperarTareasPendientes()` sigue esperando la re-evaluación pendiente, para que las pruebas sigan siendo deterministas.
  - Las reglas RN-AL (cuándo se notifica, sin repetir avisos) no cambian.
  - El contador termina siempre con el valor del último estado (ninguna actualización se pierde: ver M5 de la rama C).
  - Los suscriptores del bus siguen fire-and-forget.
- Pruebas con temporizadores falsos: 10 operaciones seguidas producen 1 (o 2) cálculos, no 20, y el contador y los avisos finales son los mismos que sin coalescer.

### Tarea 5 — Primera carga más liviana
- Cargar las librerías de Excel (`write-excel-file`, `read-excel-file`) con `import()` **solo** al exportar o importar. Que no estén en el chunk de entrada; verificarlo con el manifest del build o con un test que lo lea.
- En `vite.config.ts`, agregar al precache del service worker un `globIgnores` para las páginas de catálogo de prueba (`**/Catalogo*`). El chunk de `GraficoBarras` **no** se excluye, porque la Torre lo usará.
- Reportar el tamaño del chunk de entrada (raw y gzip) antes y después.

### Tarea 6 — Dos detalles de la rama C (menores)
- `main.ts`: si llega `versionchange` antes de montar, `montar` no debe pisar la pantalla "La app se actualizó".
- Al desmontar por `versionchange`, desconectar `useEstadoGlobal()` para que no queden suscripciones al bus.

## Verificación y entrega

```
npm run format && npm run lint:ci && npm run type-check && npm run test:cobertura && npm run build-only && npm run verificar-specs && npx playwright test
```

Además, la medición opcional de RN-SIS-09 con CPU ×4. El informe trae una tabla antes/después con los cuatro escenarios de arriba, la ráfaga incluida, y el tamaño del bundle.

Luego, revisión (spec + calidad) y PR a `develop` con los 4 checks del CI.
