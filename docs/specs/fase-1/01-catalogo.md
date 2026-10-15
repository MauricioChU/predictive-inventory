# 01 · Catálogo

Qué vende la tienda: productos, sus precios, cómo se cuentan y cómo encontrarlos rápido.

Criterios de aceptación ejecutables: [features/catalogo.feature](features/catalogo.feature)

## Historias de usuario

| Id | Historia |
|---|---|
| HU-CAT-01 | Como usuario principal quiero **registrar un producto** con su nombre, precios y cuántos me quedan, para empezar a controlar su stock. |
| HU-CAT-02 | Como usuario principal quiero **encontrar un producto escribiendo parte del nombre o escaneando su código**, para no buscar en listas largas. |
| HU-CAT-03 | Como usuario principal quiero **cambiar el precio** de un producto cuando sube, para que mis ganancias sean reales. |
| HU-CAT-04 | Como usuario principal quiero **sacar de la lista los productos que ya no vendo** sin perder su historial. |
| HU-CAT-05 | Como administrador quiero **organizar los productos en categorías** para revisarlos por grupo. |
| HU-CAT-06 | Como usuario principal quiero **ver la foto** del producto para reconocerlo sin leer. |

## Modelo

### Producto (agregado)

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | UUID | sí | Generado en el dispositivo. |
| `nombre` | texto | sí | Ej. "Lejía Tradicional 1 L". |
| `categoriaId` | UUID | sí | |
| `unidad` | `UNIDAD` \| `KILO` \| `LITRO` | sí | |
| `precioCompra` | Dinero | sí | Por unidad de medida (por unidad, por kg o por litro). |
| `precioVenta` | Dinero | sí | Por unidad de medida. |
| `stockMinimo` | Cantidad | sí | Valor sugerido en el formulario: 3. |
| `codigoBarras` | texto | no | |
| `foto` | imagen | no | |
| `estado` | `ACTIVO` \| `ARCHIVADO` | sí | |
| `creadoEn`, `actualizadoEn` | fecha-hora | sí | `actualizadoEn` sirve para sincronizar en la Fase 2. |

El **stock no es un campo del producto**: lo calcula el módulo Inventario ([02](02-operaciones.md)).

### Categoría

`id`, `nombre` (único, 2–40 caracteres). Categorías iniciales:

Lejías y desinfectantes · Detergentes y jabones · Lavavajillas · Limpiadores y ceras · Papel y descartables · Bolsas · Escobas, trapeadores y accesorios · Ambientadores e insecticidas · Carbón y combustibles · Otros

## Reglas de negocio

| Id | Regla |
|---|---|
| **RN-CAT-01** | El **nombre** es obligatorio, tiene entre 2 y 80 caracteres y es **único** entre todos los productos (activos y archivados). La comparación ignora mayúsculas, tildes y espacios repetidos: "Lejía  1L" y "lejia 1l" son el mismo nombre. |
| **RN-CAT-02** | Si el nombre coincide con un producto **archivado**, la app no crea uno nuevo: ofrece **reactivar** el archivado. |
| **RN-CAT-03** | La **unidad de medida** se elige al crear el producto y **no puede cambiarse** si el producto ya tiene operaciones (cambiaría el significado del historial). |
| **RN-CAT-04** | El **precio de venta** debe ser mayor que S/ 0.00 y el **precio de compra** mayor o igual a S/ 0.00. Ambos tienen como máximo dos decimales y no superan S/ 99 999.99. |
| **RN-CAT-05** | Si el precio de venta es **menor o igual** al precio de compra, se puede guardar solo después de una confirmación explícita que muestra cuánto se pierde por unidad. El producto aparece en *Precios para revisar* ([RN-AN-10](04-torre-de-control.md)). |
| **RN-CAT-06** | El **stock mínimo** es mayor o igual a 0 y respeta la precisión de su unidad ([RN-OP-04](02-operaciones.md)). |
| **RN-CAT-07** | El **código de barras** es opcional; si se ingresa, tiene de 4 a 32 caracteres sin espacios y es **único** entre todos los productos. |
| **RN-CAT-08** | Al crear un producto se puede indicar un **stock inicial** (≥ 0). Si es mayor que 0, se registra una operación `STOCK_INICIAL` con el precio de compra como costo. |
| **RN-CAT-09** | **Cambiar un precio solo afecta a las operaciones futuras.** Las ventas pasadas conservan el precio y el costo que tenían ([ADR-0004](../../adr/0004-costo-vigente-al-vender.md)). |
| **RN-CAT-10** | Los productos **no se eliminan, se archivan**. Un producto archivado no aparece en Vender, Llegó mercadería, alertas ni lista para comprar, pero su historial sigue contando en reportes de fechas pasadas. |
| **RN-CAT-11** | Para archivar, el stock debe ser 0. Si no lo es, la app ofrece, en el mismo paso, **retirar el stock restante** (operación `AJUSTE` hasta 0 con motivo "Producto retirado") y luego archivar. |
| **RN-CAT-12** | La **búsqueda** ignora mayúsculas y tildes y encuentra productos cuyo nombre contiene **todas las palabras escritas, en cualquier orden** ("1 l lejia" encuentra "Lejía Tradicional 1 L"). Si el texto coincide **exactamente** con un código de barras, ese producto aparece primero. Solo se buscan productos activos, salvo en el filtro *Archivados*. |
| **RN-CAT-13** | Al **escanear** un código: si existe un producto activo con ese código, se selecciona; si pertenece a uno archivado, se ofrece reactivarlo; si no existe, se ofrece **crear un producto** con el código ya cargado. Siempre se puede escribir el código a mano. |
| **RN-CAT-14** | La **foto** es opcional. Se reduce a un máximo de 512 px en su lado mayor y se guarda comprimida (≤ 100 KB). Sin foto, se muestra un ícono de su categoría. |
| **RN-CAT-15** | Una **categoría** con productos (activos o archivados) no se puede eliminar; se puede renombrar. El nombre de categoría es único con la misma comparación que RN-CAT-01. |

## Eventos de dominio

| Evento | Cuándo | Lo escuchan |
|---|---|---|
| `ProductoCreado` | Al guardar un producto nuevo | Alertas, Análisis |
| `ProductoActualizado` | Al cambiar precios, stock mínimo, nombre o categoría | Alertas (re-evaluar estado), Análisis |
| `ProductoArchivado` / `ProductoReactivado` | Al archivar o reactivar | Alertas, Análisis |

## Casos borde

- Escribir el precio con coma ("2,50") se acepta como 2.50.
- El escáner no está disponible (navegador sin soporte o sin permiso de cámara): se muestra el campo para escribir el código, sin error.
- Dos productos con el mismo código de barras en un Excel importado: se aplica [RN-RE-07](05-respaldo-e-importacion.md).
