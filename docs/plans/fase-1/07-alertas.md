# Plan 07 — Módulo Alertas (RN-AL)

> **Para agentes:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Leer [00-plan-maestro.md](00-plan-maestro.md) y [04-08-ola-2-comun.md](04-08-ola-2-comun.md) primero.

**Objetivo:** decidir **cuándo avisar** (solo cuando el estado empeora, agrupando), enviar notificaciones del sistema si hay permiso, el resumen de atención para Inicio y la barra, y el resumen del día.

**Rama:** `feat/alertas` · **Spec:** [03-alertas.md](../../specs/fase-1/03-alertas.md), [features/alertas.feature](../../specs/fase-1/features/alertas.feature).

**Consume (perezosos):** `AnalisisConsultable` (`situaciones`, `totalesDelDia`), `TiendaConsultable` (configuración y estado del sistema). El **estado** de cada producto lo calcula Análisis; aquí no se recalcula.

## Archivos

```
src/modules/alertas/
├─ domain/
│  ├─ avisos.ts            empeoro, textoDeAviso, agruparAvisos, RUTA_PARA_COMPRAR, rutaDeProducto
│  └─ atencion.ts          textoDeAtencion, lineasDelResumenDelDia
├─ application/
│  ├─ puertos.ts           RepositorioDeAvisos, Notificador, Notificacion
│  ├─ evaluar-avisos.ts
│  ├─ resumen.ts           resumenDeAtencion, resumenDelDia, cerrarResumenDelDia
│  └─ modulo.ts            crearModuloAlertas (+ suscripción a eventos)
├─ infrastructure/
│  ├─ memoria/repositorios.ts        RepositorioDeAvisosEnMemoria, NotificadorEnMemoria
│  └─ navegador/notificador-del-sistema.ts   Notification API + Service Worker
└─ index.ts
```

## Interfaces que produce

```ts
// application/puertos.ts
export interface RepositorioDeAvisos {
  todos(): Promise<AvisoRegistro[]>
  guardar(r: AvisoRegistro): Promise<void>
  eliminar(productoId: string): Promise<void>
}
export interface Notificacion { texto: string; url: string }
export interface Notificador {
  /** Permiso del navegador concedido. */
  permitido(): Promise<boolean>
  solicitarPermiso(): Promise<boolean>
  mostrar(n: Notificacion): Promise<void>
}

// application/modulo.ts
export interface DependenciasDeAlertas {
  avisos: RepositorioDeAvisos
  notificador: Notificador
  uow: UnidadDeTrabajo
  reloj: Reloj
  bus: BusDeEventos
  analisis: () => Pick<AnalisisConsultable, 'situaciones' | 'totalesDelDia'>
  tienda: () => TiendaConsultable
}
export interface ResumenDeAtencion { agotados: number; porAcabarse: number; contador: number; texto: string }
export interface ResumenDelDia { lineas: string[] }
export interface ModuloAlertas {
  evaluarAvisos(): Promise<Notificacion[]>          // devuelve lo que se notificó (vacío si no hay permiso)
  resumenDeAtencion(): Promise<ResumenDeAtencion>
  resumenDelDia(): Promise<ResumenDelDia | null>    // null si ya se cerró hoy
  cerrarResumenDelDia(): Promise<void>
  solicitarPermiso(): Promise<boolean>              // RN-AL-08: solo desde la pantalla que explica
  notificacionesPermitidas(): Promise<boolean>      // permiso del navegador Y configuración activa
  /** Suscribe evaluarAvisos a los eventos del bus. Devuelve la función para cancelar. */
  escucharEventos(): () => void
}
export function crearModuloAlertas(d: DependenciasDeAlertas): ModuloAlertas

// domain/avisos.ts
export const RUTA_PARA_COMPRAR = '/control/para-comprar'
export function rutaDeProducto(productoId: string): string     // `/productos/${id}`
```

## Reglas y textos exactos

- **RN-AL-03/04 (último estado evaluado):** `AvisoRegistro.ultimoEstadoAvisado` guarda el **último estado evaluado** del producto. Sin registro = `NORMAL`. Se avisa si `GRAVEDAD_DE_ESTADO[actual] > GRAVEDAD_DE_ESTADO[guardado]`. Después de evaluar, siempre se guarda el estado actual (así, al volver a `NORMAL` el aviso se rearma).
- **RN-AL-01:** productos que ya no aparecen en `situaciones()` (archivados) → se elimina su registro y no generan avisos.
- **Textos (RN-AL-03):**
  - `POR_ACABARSE`: `Queda poco: <nombre> (<stock>)`; con cobertura: `Queda poco: <nombre> (<stock>, se acaba en ~N días)` (N = 1 → `~1 día`; N = 0 → `se acaba hoy`).
  - `AGOTADO`: `Se acabó: <nombre>`.
- **Agrupación (RN-AL-07):** 1 aviso → `{ texto, url: rutaDeProducto(id) }`; 2 o más en la misma evaluación → **una** notificación `{ texto: 'N productos se están acabando', url: RUTA_PARA_COMPRAR }`.
- **Canales (RN-AL-06):** se envía al `Notificador` solo si `configuracion().notificacionesActivas` **y** `notificador.permitido()`. El registro de avisos se actualiza **siempre** (con o sin permiso).
- **Cuándo se evalúa (RN-AL-02):** `escucharEventos()` suscribe `evaluarAvisos` a `OperacionRegistrada`, `OperacionAnulada`, `ProductoCreado`, `ProductoActualizado`, `ProductoArchivado`, `ProductoReactivado` y `ConfiguracionActualizada`. Al abrir la app lo llama la composición (Ola 3).
- **RN-AL-08:** `solicitarPermiso` delega en el notificador; ningún otro caso de uso pide permiso.
- **Atención (RN-AL-06):** `texto`: `1 agotado y 1 por acabarse` · `2 agotados y 3 por acabarse` · `1 por acabarse` · `2 agotados` · sin nada: `Todo bien: no falta nada`. `contador = agotados + porAcabarse`.
- **Resumen del día (RN-AL-09):** si `estadoDelSistema().ultimoResumenDelDiaMostrado !== hoy`: `lineas = [<agotados>, <por acabarse>, <ayer>]` donde `<agotados>` = `1 agotado` / `N agotados` / `Nada agotado`, `<por acabarse>` = `1 por acabarse` / `N por acabarse` / `Nada por acabarse`, `<ayer>` = `Ayer ganaste S/ 48.20` (neta > 0) / `Ayer perdiste S/ X` (neta < 0) / `Ayer no hubo ventas` (ventas 0). `cerrarResumenDelDia` guarda `ultimoResumenDelDiaMostrado = hoy`.

**Notificador del sistema** (`infrastructure/navegador`): `permitido()` = `Notification.permission === 'granted'`; `solicitarPermiso()` = `Notification.requestPermission()`; `mostrar()` usa `navigator.serviceWorker.ready` → `registration.showNotification('Inventario', { body: texto, data: { url }, icon, badge, tag })` con `tag` = url (evita duplicados). Si no hay Service Worker, `new Notification(...)`. No se prueba en jsdom salvo la detección de soporte.

---

### Tarea 1: Dominio de avisos y atención

**Archivos:** `domain/avisos.ts`, `domain/atencion.ts` + specs.

Tests: `empeoro` (NORMAL→POR_ACABARSE sí; POR_ACABARSE→POR_ACABARSE no; POR_ACABARSE→AGOTADO sí; AGOTADO→NORMAL no; sin registro→AGOTADO sí), los tres formatos de texto (`Queda poco: Lejía 1 L (3 unid.)`, `Queda poco: Lejía 1 L (6 unid., se acaba en ~3 días)`, `Se acabó: Lejía 1 L`), agrupación (1 → url de producto; 3 → `3 productos se están acabando` con `RUTA_PARA_COMPRAR`), todos los textos de atención y del resumen del día.

- [ ] Rojo → verde → commit `feat(alertas): reglas de aviso y textos de atención`.

### Tarea 2: Casos de uso, repositorios en memoria y módulo

**Archivos:** `application/*`, `infrastructure/memoria/repositorios.ts`, `infrastructure/navegador/notificador-del-sistema.ts`, `index.ts` + specs.

`NotificadorEnMemoria`: `permiso: boolean` configurable, `solicitudes: number`, `mostradas: Notificacion[]`.

Tests (datos de `alertas.feature`, con un análisis falso que devuelve `SituacionDeProducto` configurables):
- RN-AL-03: Lejía pasa de NORMAL a POR_ACABARSE → una notificación con el texto exacto; evaluar otra vez sin cambio → no hay nueva (total 1); pasar a AGOTADO → `Se acabó: Lejía 1 L`.
- RN-AL-04: AGOTADO → NORMAL → POR_ACABARSE → avisa otra vez.
- RN-AL-01: producto archivado desaparece de `situaciones()` → se borra su registro, sin aviso.
- RN-AL-02: con `escucharEventos()`, publicar `OperacionRegistrada` en el bus dispara la evaluación.
- RN-AL-06: sin permiso → `mostradas` vacío pero el registro se actualiza; `resumenDeAtencion` = `1 agotado y 1 por acabarse`, contador 2 (Bolsas NORMAL no cuenta).
- RN-AL-07: tres productos empeoran a la vez → **una** notificación `3 productos se están acabando` con `RUTA_PARA_COMPRAR`.
- RN-AL-08: `evaluarAvisos` y `resumenDelDia` nunca llaman `solicitarPermiso` (`solicitudes === 0`); `solicitarPermiso()` sí (1).
- RN-AL-09: resumen con `1 agotado`, `1 por acabarse`, `Ayer ganaste S/ 48.20`; tras `cerrarResumenDelDia()` → `null` el mismo día; al día siguiente (`reloj.fijar`) vuelve a aparecer.

- [ ] Rojo → verde → verificación final de la rama → commit `feat(alertas): avisos sin repetición, agrupados y resumen del día`.
