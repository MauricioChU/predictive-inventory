# ADR-0004 · Costo vigente al momento de vender

**Estado:** Aceptado · 2026-10-15

## Contexto

Para calcular la ganancia se necesita el costo de lo vendido. Las opciones habituales son costo promedio ponderado, FIFO o último costo de compra. El usuario principal debe entender el número que ve.

## Decisión

- Cada producto tiene un **precio de compra vigente**. Al vender, la línea guarda una **copia** de ese precio como `costoUnitario`, junto con el precio de venta aplicado.
- Al registrar mercadería con un costo distinto, la app ofrece **actualizar** el precio de compra vigente.
- Las mermas y los ajustes también guardan el costo vigente.

## Consecuencias

- ✅ "Ganancia = precio de venta − precio de compra" es exactamente lo que el usuario espera.
- ✅ Cambiar precios no altera el pasado (RN-CAT-09).
- ⚠️ Si conviven unidades compradas a distinto precio, la ganancia es una aproximación. Es aceptable para una tienda y se puede pasar a costo promedio en el futuro sin cambiar el modelo, porque el costo ya se guarda por línea.
