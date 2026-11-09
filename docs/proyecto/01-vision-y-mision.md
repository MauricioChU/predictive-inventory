# 01 · Visión, misión y principios

> Por qué existe este proyecto, hacia dónde va y qué no se negocia en el camino.
> Arquitectura, módulos y glosario: [00-vision-y-arquitectura](../specs/00-vision-y-arquitectura.md).

## El origen

Una tienda de barrio de **productos de limpieza** (como lejía por unidad y algo a granel, como el carbón por kilo) la atiende una **persona mayor**. Lleva el stock de memoria o en un cuaderno. La mercadería está desordenada y **no tiene códigos de barras**: los productos se reconocen por el nombre y por cómo se ven.

Eso trae cuatro problemas concretos:

| Problema | Qué pasa en la tienda |
|---|---|
| **Se compra de más** | Sin saber cuánto hay ni cuánto se vende, en el mercado mayorista se compra "por si acaso". El dinero queda parado en el estante durante semanas. |
| **Los productos se acaban sin aviso** | El cliente pide algo que ya no hay y se va a otra tienda. |
| **No se sabe cuánto se gana** | Se sabe cuánto entró a la caja, pero no cuánto quedó después de pagar la mercadería, lo que se dañó y el alquiler del local. |
| **Los datos se pueden perder** | Un cuaderno se moja; un celular se pierde. |

El problema de fondo es el primero: **comprar mercadería de más**. Todo lo demás lo alimenta o sale de él.

## Misión

> **Que una tienda pequeña sepa, desde su celular y sin internet, cuánto tiene, cuánto gana y qué le conviene comprar, para que deje de comprar de más y nunca pierda sus datos.**

Una aplicación que una persona mayor use sola, en segundos, con letra grande y con las palabras de su tienda.

## Visión

> **Ser la libreta inteligente de la tienda: el dueño decide con sus propios números, la familia acompaña a distancia y ningún dato se pierde.**

Cómo se ve cuando se cumple:

1. **En la tienda.** Vender o recibir mercadería toma segundos. El dueño no anota nada en papel.
2. **En el mercado mayorista.** Antes de comprar, el dueño pregunta "¿Necesito comprar?" y la app le responde con una frase: *"No compres: no se vende hace 40 días y tienes 12"* o *"Sí, compra ~6"*.
3. **Al final del día.** El dueño sabe cuánto vendió y cuánto ganó de verdad, y si ya cubrió el alquiler del local.
4. **A distancia** (fases 2 y 3). Un familiar recibe los avisos importantes (algo se acabó, el resumen del día, el pago del local) y, más adelante, puede consultar la tienda desde cualquier navegador.
5. **Siempre.** Si el celular se pierde, la tienda se recupera completa en otro.

## Para quién

| Persona | Rol | Qué le importa |
|---|---|---|
| **Usuario principal**: la persona mayor que atiende la tienda | Usa la app todos los días en un celular Android | Vender rápido, saber qué falta, no equivocarse, entender todo sin ayuda. |
| **Administrador**: un familiar que apoya | Configura, carga productos y revisa los números | Que los números cuadren, que no se pierdan datos y, más adelante, saber cómo va la tienda sin estar ahí. |

## Propuesta de valor

| Antes | Con la app |
|---|---|
| "Creo que hay como cinco." | "Quedan 5 unid. · Se acaba en ~4 días." |
| Comprar por si acaso. | Una **lista para comprar** con cantidades sugeridas y cuánto dinero llevar, y un **aviso de sobrecompra** si se compra para más de 30 días. |
| Enterarse de que algo se acabó cuando lo pide un cliente. | Avisos de **Queda poco** y **Agotado** antes de que pase. |
| "Hoy entró bastante." | **Total vendido** y **Ganancia real** de hoy, con pérdidas y diferencias de conteo descontadas. |
| Mercadería que nadie compra, olvidada en el estante. | **Productos parados**, con el dinero que tienen inmovilizado. |
| Un cuaderno que se puede perder. | Copias de seguridad, Excel y, desde la Fase 2, copia automática en la nube. |

## Principios

Son las reglas que deciden cuando dos caminos parecen buenos. Están ordenados: si dos chocan, gana el de arriba.

### Del producto

1. **Funciona sin internet, siempre.** La app nunca espera a un servidor para responder. La nube, cuando llegue, trabaja en segundo plano ([ADR-0001](../adr/0001-local-first.md)).
2. **Nunca perder datos.** Almacenamiento persistente, respaldos y, desde la Fase 2, copia en la nube. Nada se borra: se anula ([ADR-0002](../adr/0002-libro-de-operaciones-inmutable.md)).
3. **Los números cuadran.** Dinero en céntimos y cantidades en milésimas, todo en enteros ([ADR-0003](../adr/0003-enteros-para-dinero-y-cantidades.md)). El stock es la suma de un libro de operaciones que no se edita.
4. **Simple antes que completo.** Una acción principal por pantalla. Lo avanzado va en Control y en Ayuda inteligente.
5. **Lenguaje de la tienda.** "Llegó mercadería", no "registrar ingreso"; "Se acaba en ~4 días", no "cobertura".

### De la experiencia (persona mayor)

1. **Se lee sin lentes**: letra grande por defecto (tres tamaños) y alto contraste (7:1).
2. **Se entiende sin explicaciones**: íconos siempre acompañados de texto.
3. **Nada se pierde por un toque equivocado**: todo se puede deshacer o se confirma con un resumen claro.
4. **Nunca un callejón sin salida**: siempre hay un "Volver" visible y un mensaje que dice qué hacer.
5. **Al alcance del pulgar**: la acción principal va grande y abajo; nada tocable mide menos de 48 px.

### De la ingeniería

1. **Primero la regla escrita, después el código.** Cada regla de negocio tiene un número (`RN-*`), al menos un escenario Gherkin y un test ([ADR-0006](../adr/0006-specs-ejecutables.md)).
2. **El dominio no depende de nada.** Arquitectura hexagonal por módulos, verificada por el lint ([ADR-0005](../adr/0005-arquitectura-hexagonal-modular.md)).
3. **Costo cero.** Publicación en GitHub Pages; en la nube, solo planes gratis que no pidan tarjeta.
4. **Nada entra sin revisión ni CI en verde.** Ramas protegidas y pull requests ([ADR-0009](../adr/0009-flujo-de-ramas-y-ci.md)).

## Qué no es

Decir que no a esto mantiene la app simple:

- **No es un punto de venta con boletas ni facturas** (SUNAT).
- **No es una caja**: no hay arqueo, apertura ni cierre de caja, ni vuelto.
- **No es para varias tiendas** ni para cadenas.
- **No usa códigos de barras**: la tienda no los tiene. Los productos se buscan por nombre y foto.
- **No es un producto comercial**: es una herramienta hecha a la medida de una tienda real.

## Cómo sabremos que funciona

| Indicador | Meta |
|---|---|
| Registrar una venta de un producto conocido | Menos de **15 segundos** desde Inicio |
| Saber si hay que comprar un producto | Menos de **10 segundos** con "¿Necesito comprar?", también sin internet |
| Uso sin ayuda | El dueño vende y recibe mercadería solo después de una sesión de explicación |
| Dinero en productos parados | Baja mes a mes |
| Compras con aviso de sobrecompra | Cada vez menos, porque se compra con la lista |
| Datos perdidos | Ninguno, nunca |
