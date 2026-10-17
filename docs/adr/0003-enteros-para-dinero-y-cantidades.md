# ADR-0003 · Enteros para dinero y cantidades

**Estado:** Aceptado · 2026-10-15

## Contexto

En JavaScript `0.1 + 0.2` no es exactamente `0.3`. Una tienda no puede tener ganancias que "casi" cuadran, y se venden productos por kilo con decimales.

## Decisión

- **Dinero** (`Dinero`): entero en **céntimos** de sol. `S/ 3.50` → `350`.
- **Cantidad** (`Cantidad`): entero en **milésimas** de la unidad. `1.25 kg` → `1250`; `3 unid.` → `3000`.
- `Dinero × Cantidad` se calcula como `céntimos × milésimas / 1000` y se **redondea al céntimo, mitad hacia arriba**, por línea.
- Ambos son objetos de valor inmutables del dominio compartido, con validación de precisión según la unidad (enteros para `UNIDAD`, hasta 3 decimales para `KILO` y `LITRO`).
- Se usa el mismo formato en la base local, en el respaldo y en la API de la Fase 2 (en Postgres: `BIGINT`).

## Consecuencias

- ✅ Sumas exactas y deterministas en frontend y backend.
- ⚠️ La conversión a texto (`S/ 3.50`, `1.25 kg`) se centraliza en `shared/domain/formato.ts`, porque los mensajes de las reglas de negocio la necesitan; ningún otro archivo formatea montos ni cantidades.
