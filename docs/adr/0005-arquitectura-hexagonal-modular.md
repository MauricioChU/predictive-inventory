# ADR-0005 · Arquitectura hexagonal por módulos

**Estado:** Aceptado · 2026-10-15

## Contexto

Las mismas reglas de negocio deben vivir en el celular (Fase 1) y en el servidor (Fase 2), y la persistencia y las notificaciones cambiarán con las fases (IndexedDB → sincronización; notificación local → push).

## Decisión

- El código se organiza por **módulos de negocio** (`catalogo`, `inventario`, `alertas`, `analisis`, `respaldo`), cada uno con las capas `domain`, `application`, `infrastructure` y `ui`.
- El **dominio es TypeScript puro**: no importa Vue, Pinia, Dexie ni APIs del navegador. Habla con el exterior mediante **puertos** (interfaces), por ejemplo `RepositorioDeProductos`, `UnidadDeTrabajo`, `Reloj`, `GeneradorDeIds`, `Notificador` y `ProcesadorDeFotos`.
- Los **adaptadores** viven en `infrastructure`; la composición se hace en `src/app` (inyección de dependencias con `provide` / `inject`).
- Los módulos se comunican solo por casos de uso y **eventos de dominio**, nunca por las tablas de otro módulo.
- **ESLint `no-restricted-imports`** hace fallar el lint si el dominio importa algo prohibido o si un módulo importa el interior de otro.
- El backend (Fase 2) usa la misma organización en Python.

## Consecuencias

- ✅ El dominio se prueba rápido y sin navegador.
- ✅ Agregar la sincronización o el push es agregar adaptadores, no reescribir reglas.
- ⚠️ Hay más archivos que en una app "todo en el componente"; se compensa con una estructura predecible.
