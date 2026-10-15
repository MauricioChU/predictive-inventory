# ADR-0002 · Libro de operaciones inmutable

**Estado:** Aceptado · 2026-10-15

## Contexto

Un número de stock que se sobrescribe no explica cómo llegó a su valor, se corrompe con facilidad y es difícil de sincronizar entre dispositivos.

## Decisión

- Todo cambio de stock es una **Operación** (venta, ingreso, merma, ajuste, stock inicial, anulación) con uno o más **Movimientos** con signo.
- Las operaciones **no se editan ni se borran**. Para corregir, se registra una **Anulación** que invierte la original.
- El stock (**Existencia**) y los **Resúmenes diarios** son **proyecciones**: se actualizan en la misma transacción que la operación y se pueden reconstruir desde el libro en cualquier momento.

## Consecuencias

- ✅ Historial completo y auditable: "¿por qué hay 7?" siempre tiene respuesta.
- ✅ La sincronización (Fase 2) se reduce a enviar operaciones nuevas con su UUID: es idempotente y casi no hay conflictos.
- ✅ Las proyecciones dañadas se reparan recalculando (RN-OP-19).
- ⚠️ El libro crece siempre; con el volumen de una tienda (~50 000 movimientos al año) no es un problema en IndexedDB.
