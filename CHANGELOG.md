# Novedades

Qué cambia en la app en cada versión, en palabras de la tienda. Cómo se numeran y publican las versiones: [ADR-0010](docs/adr/0010-versiones-y-publicacion.md).

## Sin publicar

### Cambiado

- Vender: el bloque «En esta venta» está abajo desde el inicio, en S/ 0.00; al elegir un producto crece hasta ocupar la pantalla y al tocar «Ocultar» vuelve a meterse abajo, despacio.
- Ya no se puede vender más de lo que hay: el + se detiene, lo escrito de más vuelve a lo que hay y tocar otra vez un producto agotado no lo suma.
- Al registrar una venta, la confirmación aparece al centro con una animación y muestra lo que vendiste: cada producto con su cantidad, precio e importe, y el total.
- En el panel de venta, el botón para sacar un producto de la venta dice «Cancelar».

## [0.4.0] · 2026-10-20

### Nuevo

- Puedes vender algunas unidades a otro precio (por ejemplo, de 5, una más barata para un amigo): toca «¿Vendiste alguno a otro precio?», di cuántos y a cuánto; nunca deja poner más de los que estás vendiendo, y la venta guarda cada precio por separado. Mientras ese formulario esté abierto no se puede confirmar la venta: primero guarda o cancela.

### Cambiado

- Vender: al elegir un producto se abre, a toda la pantalla, el panel con lo que llevas, cuánto queda de cada uno y el botón para confirmar; con «Ocultar» vuelves a la lista para agregar más. El panel sube y baja despacio, para que se vea.
- En el panel, el precio por unidad va debajo del importe y es el botón para cambiarlo; Quitar va junto a − / +.
- Inicio muestra la fecha en mayúsculas y el nombre de tu tienda sin saludo; Ajustes queda solo con la tuerca.

### Quitado

- Ya no se calcula el vuelto ni se pregunta con cuánto pagan.

## [0.3.1] · 2026-10-19

### Cambiado

- Inicio muestra la fecha y la hora, y los botones de Vender y Llegó mercadería quedan abajo, al alcance del pulgar.

## [0.3.0] · 2026-10-19

### Nuevo

- En Productos puedes filtrar por «Se acaban».
- El aviso de copia ahora está en Ajustes.
- El recordatorio del pago del local se ve en la tarjeta de Control.

### Cambiado

- Inicio queda solo para vender: se quitaron el resumen del día, el recordatorio del local, el aviso de copia y el de instalar la app.
- Cuando algo se acaba, el aviso te lleva a Productos ya filtrado.

## [0.2.0] · 2026-10-18

### Nuevo

- Control muestra si lo que llevas ganado ya cubre el alquiler del local, y la app te recuerda el pago dos días antes.
- Si cambias de celular, puedes restaurar tu copia desde la bienvenida.

### Cambiado

- La primera vez que abres la app te guía paso a paso y no te deja salir hasta terminar.

## [0.1.0] · 2026-10-17

### Nuevo

- Primera versión de la app de inventario: funciona sin internet en el celular y se instala desde Chrome.
- Productos con foto y categoría, vendidos por unidad, kilo o litro.
- Vender, Llegó mercadería, pérdidas (se dañó, se derramó, se venció), contar stock y conteo guiado.
- Avisos cuando algo se acaba o queda poco, con resumen al empezar el día.
- Control: cuánto ganas, qué comprar y cuánto dinero necesitas, lo que más se vende, productos parados y "¿Necesito comprar?".
- Guardar y restaurar copias, exportar a Excel e importar productos desde una plantilla.

[0.3.1]: https://github.com/MauricioChU/predictive-inventory/releases/tag/v0.3.1
[0.3.0]: https://github.com/MauricioChU/predictive-inventory/releases/tag/v0.3.0
[0.2.0]: https://github.com/MauricioChU/predictive-inventory/releases/tag/v0.2.0
[0.1.0]: https://github.com/MauricioChU/predictive-inventory/releases/tag/v0.1.0
