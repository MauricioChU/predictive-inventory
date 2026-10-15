# Fase 1 — App local en el celular

## Objetivo

Que la tienda pueda llevar **todo su inventario desde el celular, sin internet**, con alertas de stock, ganancias y recomendaciones de compra. Al terminar esta fase, la app está publicada como PWA y se instala en el Android del usuario principal.

## Incluido

| Módulo | Capacidades | Spec |
|---|---|---|
| Catálogo | Productos con precios, unidad (unid./kg/L), categoría, stock mínimo y foto. Búsqueda por nombre. Archivar. | [01](01-catalogo.md) |
| Inventario | Venta con carrito, total y vuelto. Llegada de mercadería con **aviso de sobrecompra**. Mermas. Conteo de stock y **conteo guiado** de toda la tienda. Historial. Deshacer y anular. | [02](02-operaciones.md) |
| Alertas | Estados *Agotado* / *Por acabarse* / *Normal*, avisos en la app, notificaciones del sistema y resumen del día. | [03](03-alertas.md) |
| Análisis | Torre de control: ganancia, "se acaba en ~N días", lista para comprar, más vendidos, productos parados, precios para revisar, semana contra semana, mejor día. Consulta **"¿Necesito comprar?"**. | [04](04-torre-de-control.md) |
| Respaldo | Exportar a Excel, respaldo completo, restaurar, importar productos desde Excel, recordatorio de respaldo. | [05](05-respaldo-e-importacion.md) |
| Experiencia | Diseño para persona mayor, tamaño de letra configurable, responsive de 320 px a escritorio, accesibilidad, instalación. | [06](06-experiencia-de-uso.md) |
| Calidad | Tests por regla, specs ejecutables, E2E en tamaños de celular, CI, Definition of Done. | [07](07-calidad.md) |

## Fuera de alcance (Fase 1)

- Sincronización con la nube y uso desde varios dispositivos → Fase 2 y 3.
- Notificaciones **con la app cerrada** (requieren servidor) → Fase 2.
- Inicio de sesión y usuarios → Fase 3.
- Boletas o facturas electrónicas (SUNAT), caja/arqueo, proveedores, precios por mayor, varias tiendas.

## Criterios de éxito

1. Registrar la venta de un producto conocido toma **menos de 15 segundos** desde la pantalla de inicio.
2. Ninguna pantalla tiene desplazamiento horizontal entre **320 px y 1920 px** de ancho, ni con la letra en *Muy grande*.
3. Todas las reglas de negocio (`RN-*`) tienen escenarios Gherkin y tests en verde.
4. La app funciona completa en **modo avión**.
5. El usuario principal usa las funciones de Vender y Llegó mercadería sin ayuda tras una sesión de explicación.
6. Saber si hay que comprar un producto toma **menos de 10 segundos** ("¿Necesito comprar?"), también sin internet, por ejemplo en el mercado mayorista.

## Configuración del negocio (valores iniciales)

| Ajuste | Valor inicial | Rango | Para qué sirve |
|---|---|---|---|
| Nombre de la tienda | — | 1–40 caracteres | Saludo y nombre del Excel |
| Cada cuántos días compras mercadería | 7 | 1–60 | Cálculo de cantidad sugerida |
| Avisar con cuántos días de anticipación | 3 | 1–14 | Estado *Por acabarse* por predicción |
| Avisar si una compra alcanza para más de | 30 días | 7–180 | Aviso de sobrecompra (RN-OP-20) |
| Tamaño de letra | Grande | Normal / Grande / Muy grande | Legibilidad |
| Notificaciones del sistema | Desactivadas hasta que el usuario acepte | Sí / No | Avisos fuera de la pantalla actual |

## Supuestos

- Zona horaria de la tienda: la del celular (Perú, `America/Lima`, UTC−5). Un "día" va de 00:00 a 23:59 en esa zona.
- Moneda única: soles (`S/`), dos decimales.
- Un solo dispositivo registra operaciones en esta fase.
