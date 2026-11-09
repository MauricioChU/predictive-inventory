# 02 · Alcance

> Qué hace el proyecto, qué no hace y bajo qué condiciones. El detalle de cada regla está en las [specs](../specs/README.md); este documento es el mapa.

## Alcance general

El proyecto cubre el **inventario, las ventas y la toma de decisiones de compra** de una sola tienda pequeña, en tres fases. Cada fase tiene su propia spec, su plan y su implementación, y se especifica **al terminar la anterior**, con lo aprendido en uso real.

| Fase | Entrega | Estado |
|---|---|---|
| **1 · App local** | PWA instalable en Android, 100 % sin internet | ✅ **Publicada** (v0.1.0 → v0.6.0). En uso real en la tienda. |
| **2 · Nube** | Backend FastAPI + Postgres (Neon): copia en la nube, recuperar la tienda en otro celular, avisos con la app cerrada, respaldos nocturnos | 📝 Decisiones tomadas; la spec se escribe después del uso real. |
| **3 · Consulta a distancia** | La misma PWA desde cualquier navegador, con inicio de sesión del administrador | 💭 Idea. Se especifica al cerrar la Fase 2. |

## Fase 1 · App local (incluido)

Todo funciona **en el celular, sin internet**. Detalle por pantalla: [04-funcionalidades](04-funcionalidades.md).

| Módulo | Qué incluye | Spec |
|---|---|---|
| **Catálogo** | Productos con nombre, foto, categoría, precio de compra y de venta, stock mínimo y unidad (unidad, kilo o litro). Búsqueda por parte del nombre. Archivar sin perder el historial. | [01](../specs/fase-1/01-catalogo.md) |
| **Inventario** | Vender (uno o varios productos, con total). Llegó mercadería, con **aviso de sobrecompra**. Pérdidas (se dañó, se derramó, se venció). Contar stock y **conteo guiado** de toda la tienda. Deshacer y anular. Ventas de días anteriores. Movimientos (historial). | [02](../specs/fase-1/02-operaciones.md) |
| **Alertas** | Estados *Agotado*, *Por acabarse* y *Normal*. Avisos dentro de la app y notificaciones del sistema (con la app abierta o recién usada), sin repetirse. Recordatorio del pago del local. | [03](../specs/fase-1/03-alertas.md) |
| **Análisis** | Total vendido y Ganancia real. "Se acaba en ~N días". Lista para comprar, con cantidades sugeridas y costo. Mejores productos. Productos parados. Precios para revisar. Semana contra semana. Mejor día de la semana. "¿Necesito comprar?". Alquiler del local. | [04](../specs/fase-1/04-torre-de-control.md) |
| **Respaldo** | Exportar a Excel. Copia completa (con fotos) y restauración, también desde la bienvenida de un celular nuevo. Importar productos desde una plantilla de Excel. Recordatorio de copia. | [05](../specs/fase-1/05-respaldo-e-importacion.md) |
| **Experiencia** | Diseño para persona mayor, tres tamaños de letra, de 320 px a pantallas de escritorio, accesibilidad e instalación. | [06](../specs/fase-1/06-experiencia-de-uso.md) |
| **Calidad** | Tests por regla, specs ejecutables, E2E en celular y PC, CI y Definition of Done. | [07](../specs/fase-1/07-calidad.md) |

En números: **75 reglas de negocio vigentes** (`RN-CAT`, `RN-OP`, `RN-AL`, `RN-AN`, `RN-RE`), cada una con su escenario Gherkin y sus tests, más las reglas de experiencia (`RN-UX`) y de sistema (`RN-SIS`), que se verifican con pruebas E2E.

### Fuera de alcance de la Fase 1

- Sincronizar con la nube y usar la app en varios dispositivos → Fases 2 y 3.
- Notificaciones **con la app cerrada** (necesitan un servidor) → Fase 2.
- Inicio de sesión y usuarios → Fase 3.

## Fase 2 · Nube (decisiones preliminares)

> Se tomaron en una sesión de diseño el 2026-10-26. **Todavía no son una spec aprobada**: se confirman o se cambian después del uso real de la v0.6.0.

**Objetivo:** que la tienda **no pierda datos aunque pierda el celular** y que los avisos importantes **lleguen con la app cerrada**, al dueño y a un familiar.

| Tema | Decisión |
|---|---|
| **Avisos con la app cerrada** | Resumen del día, producto *por acabarse* o *agotado*, pago del local y, solo al familiar, "el celular de la tienda no se conecta hace 3 días". La lista para comprar **no** se envía. |
| **Quién los recibe** | El celular de la tienda y el de un familiar. El familiar **solo recibe avisos**: no ve el inventario ni registra nada (eso es Fase 3). |
| **Recuperar la tienda** | Todo, con fotos: productos, historial, ajustes y fotos, desde la bienvenida de un celular nuevo ("Recuperar mi tienda"). |
| **Costo y servicios** | S/ 0 y sin tarjeta: Neon (base de datos), Render gratis (API), cron-job.org (tareas a su hora) y GitHub Actions (copias nocturnas **cifradas**, porque el repositorio es público). |
| **Quién calcula los avisos** | **Mixto**: la nube calcula el resumen del día y las fechas de pago del local (con los mismos escenarios Gherkin que el celular, para que las cifras coincidan). El celular calcula la predicción de stock y sube su agenda de avisos. |
| **Orden propuesto** | (1) Prueba de push en el celular real de la tienda, (2) **Entrega A**: copia en la nube y recuperar la tienda, (3) **Entrega B**: avisos y respaldos nocturnos. |

**Fuera de alcance de la Fase 2:** inicio de sesión, que el familiar vea el inventario, varios celulares registrando a la vez y Telegram.

## Fase 3 · Consulta a distancia (idea)

- Inicio de sesión del administrador.
- **Modo consulta** (solo lectura) desde cualquier navegador: cifras, productos y movimientos.
- Avisos por Telegram (opcional).
- Después: registrar desde varios dispositivos.

## Fuera de alcance del proyecto

No está previsto en ninguna fase:

- Boletas o facturas electrónicas (SUNAT).
- Caja: arqueo, apertura, cierre y vuelto.
- Proveedores con cuentas por pagar.
- Precios por mayor o listas de precios por cliente.
- Varias tiendas.
- Códigos de barras.

Ideas abiertas, que se evaluarán con el uso real: **fiado** (ventas a cuenta), **cierre del día** y **proveedores**. Ver [03-hoja-de-ruta](03-hoja-de-ruta.md).

## Restricciones

| Restricción | Consecuencia en el diseño |
|---|---|
| El usuario principal es una persona mayor con poca experiencia en apps | Letra grande, pocos pasos, una acción por pantalla, nada técnico en pantalla. |
| Usa un **celular Android** | PWA instalada desde Chrome; se prueba en 360 × 740 y 320 px de ancho. |
| La tienda puede quedarse **sin internet** | Todo se calcula en el celular (local-first). |
| **No hay códigos de barras** | Búsqueda por nombre y reconocimiento por foto. |
| **Costo cero** | GitHub Pages para la app; planes gratis sin tarjeta para la nube. |
| Una sola persona registra | Fase 1 y 2 suponen **un solo dispositivo** que registra operaciones. |

## Supuestos

- Zona horaria de la tienda: Perú (`America/Lima`, UTC−5). Un día va de 00:00 a 23:59.
- Moneda única: soles (`S/`), con dos decimales.
- Volumen de una tienda de barrio: unos cientos de productos y unos 50 000 movimientos al año.

## Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| El dueño no adopta la app | Uso real acompañado antes de cada fase; cambios guiados por lo que le cuesta. |
| Datos perdidos por cambio o pérdida del celular | Copia manual con recordatorio (hoy); copia automática en la nube (Fase 2). |
| Los datos de la app pertenecen a la dirección web | No cambiar de dominio sin migrar los datos ([ADR-0007](../adr/0007-hosting-github-pages.md)). |
| Push poco confiable en algunas marcas de Android (ahorro de batería) | Probar en el celular real **antes** de construir los avisos de la Fase 2. |
| Servicios gratis que cambian sus condiciones | Código independiente del proveedor; cambiar de servicio es cambiar dónde se publica, no reescribir. |
| Tareas programadas de GitHub se desactivan tras 60 días sin cambios en un repositorio público | Vigilarlo en la spec de la Fase 2 (aviso si falla la copia nocturna). |
