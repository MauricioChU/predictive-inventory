# language: es
Característica: Catálogo de productos
  Para controlar el stock de la tienda
  como usuario principal
  quiero registrar, encontrar y mantener mis productos

  Antecedentes:
    Dado que hoy es "2026-10-15 10:00"
    Y existen las categorías "Lejías y desinfectantes, Carbón y combustibles, Otros"

  @RN-CAT-01
  Esquema del escenario: El nombre es obligatorio, tiene un largo válido y no se repite
    Dado los productos:
      | nombre      | categoría               | unidad | compra | venta | mínimo |
      | Lejía 1 L   | Lejías y desinfectantes | UNIDAD | 2.40   | 3.50  | 3      |
    Cuando creo un producto con nombre "<nombre>"
    Entonces el resultado es "<resultado>"

    Ejemplos:
      | nombre        | resultado                              |
      | Lejía 2 L     | creado                                 |
      | lejia 1 l     | error: Ya existe un producto con ese nombre |
      | LEJÍA   1 L   | error: Ya existe un producto con ese nombre |
      | L             | error: El nombre debe tener entre 2 y 80 letras |
      |               | error: Escribe el nombre del producto  |

  @RN-CAT-02
  Escenario: Un nombre de producto archivado ofrece reactivarlo
    Dado los productos:
      | nombre    | categoría | unidad | compra | venta | mínimo | archivado |
      | Escoba    | Otros     | UNIDAD | 6.00   | 9.00  | 2      | sí        |
    Cuando creo un producto con nombre "escoba"
    Entonces no se crea un producto nuevo
    Y se ofrece reactivar el producto "Escoba"

  @RN-CAT-03
  Escenario: La unidad no cambia si el producto ya tiene operaciones
    Dado los productos:
      | nombre | categoría             | unidad | compra | venta | mínimo | stock |
      | Carbón | Carbón y combustibles | KILO   | 2.75   | 4.00  | 3      | 10    |
    Cuando cambio la unidad de "Carbón" a "UNIDAD"
    Entonces el resultado es "error: No puedes cambiar la unidad de un producto que ya tiene movimientos"

  @RN-CAT-03
  Escenario: La unidad sí cambia si el producto no tiene operaciones
    Dado los productos:
      | nombre | categoría             | unidad | compra | venta | mínimo |
      | Carbón | Carbón y combustibles | UNIDAD | 2.75   | 4.00  | 3      |
    Cuando cambio la unidad de "Carbón" a "KILO"
    Entonces el producto "Carbón" tiene unidad "KILO"

  @RN-CAT-04
  Esquema del escenario: Los precios deben ser válidos
    Cuando creo un producto con precio de compra "<compra>" y precio de venta "<venta>"
    Entonces el resultado es "<resultado>"

    Ejemplos:
      | compra    | venta     | resultado                                        |
      | 2.40      | 3.50      | creado                                           |
      | 0.00      | 1.00      | creado                                           |
      | 2,40      | 3,50      | creado                                           |
      | 2.40      | 0.00      | error: El precio de venta debe ser mayor que S/ 0.00 |
      | -1.00     | 3.50      | error: El precio de compra no puede ser negativo |
      | 2.405     | 3.50      | error: Usa como máximo dos decimales            |
      | 2.40      | 100000.00 | error: El precio no puede pasar de S/ 99 999.99  |

  @RN-CAT-05
  Escenario: Un precio de venta con pérdida requiere confirmación
    Cuando creo un producto con precio de compra "5.00" y precio de venta "4.50"
    Entonces se pide confirmar con el mensaje "Vas a perder S/ 0.50 por cada unidad"
    Cuando confirmo
    Entonces el resultado es "creado"

  @RN-CAT-06
  Esquema del escenario: El stock mínimo respeta la unidad
    Cuando creo un producto con unidad "<unidad>" y stock mínimo "<mínimo>"
    Entonces el resultado es "<resultado>"

    Ejemplos:
      | unidad | mínimo | resultado                                       |
      | UNIDAD | 3      | creado                                          |
      | UNIDAD | 0      | creado                                          |
      | UNIDAD | 2.5    | error: Este producto se cuenta por unidades enteras |
      | KILO   | 2.5    | creado                                          |
      | KILO   | 0.0005 | error: Usa como máximo tres decimales          |
      | LITRO  | -1     | error: El stock mínimo no puede ser negativo    |

  @RN-CAT-08
  Escenario: Crear un producto con stock inicial registra la operación
    Cuando creo el producto "Lejía 1 L" con unidad "UNIDAD", precio de compra "2.40", precio de venta "3.50", stock mínimo "3" y stock inicial "12"
    Entonces el stock de "Lejía 1 L" es "12"
    Y existe una operación "STOCK_INICIAL" de "12" para "Lejía 1 L" con costo "2.40"

  @RN-CAT-08
  Escenario: Crear un producto sin stock inicial no registra operaciones
    Cuando creo el producto "Lejía 1 L" con unidad "UNIDAD", precio de compra "2.40", precio de venta "3.50", stock mínimo "3" y stock inicial "0"
    Entonces el stock de "Lejía 1 L" es "0"
    Y "Lejía 1 L" no tiene operaciones

  @RN-CAT-09
  Escenario: Cambiar el precio no altera las ventas pasadas
    Dado los productos:
      | nombre    | categoría               | unidad | compra | venta | mínimo | stock |
      | Lejía 1 L | Lejías y desinfectantes | UNIDAD | 2.40   | 3.50  | 3      | 10    |
    Y vendo "2" de "Lejía 1 L"
    Cuando cambio el precio de venta de "Lejía 1 L" a "4.00" y el de compra a "2.80"
    Y vendo "1" de "Lejía 1 L"
    Entonces las ventas de hoy son "S/ 11.00"
    Y la ganancia bruta de hoy es "S/ 3.40"

  @RN-CAT-10
  Escenario: Un producto archivado no se puede vender pero su historial cuenta
    Dado los productos:
      | nombre | categoría | unidad | compra | venta | mínimo | stock |
      | Escoba | Otros     | UNIDAD | 6.00   | 9.00  | 2      | 1     |
    Y vendo "1" de "Escoba"
    Cuando archivo "Escoba"
    Entonces al buscar "escoba" para vender no aparece ningún producto
    Y las ventas de hoy son "S/ 9.00"

  @RN-CAT-11
  Escenario: Archivar un producto con stock ofrece retirarlo
    Dado los productos:
      | nombre | categoría | unidad | compra | venta | mínimo | stock |
      | Escoba | Otros     | UNIDAD | 6.00   | 9.00  | 2      | 4     |
    Cuando archivo "Escoba"
    Entonces se pide confirmar con el mensaje "Aún quedan 4 unid. ¿Las retiramos del stock?"
    Cuando confirmo
    Entonces existe una operación "AJUSTE" de "-4" para "Escoba" con motivo "Producto retirado"
    Y el producto "Escoba" está archivado

  @RN-CAT-12
  Esquema del escenario: La búsqueda encuentra por palabras en cualquier orden, sin tildes
    Dado los productos:
      | nombre                 | categoría               | unidad | compra | venta | mínimo |
      | Lejía Tradicional 1 L  | Lejías y desinfectantes | UNIDAD | 2.40   | 3.50  | 3      |
      | Lejía Tradicional 2 L  | Lejías y desinfectantes | UNIDAD | 4.30   | 6.20  | 3      |
      | Carbón vegetal         | Carbón y combustibles   | KILO   | 2.75   | 4.00  | 3      |
    Cuando busco "<texto>"
    Entonces los resultados son "<resultados>"

    Ejemplos:
      | texto          | resultados                                   |
      | lejia          | Lejía Tradicional 1 L, Lejía Tradicional 2 L |
      | 1 l lejia      | Lejía Tradicional 1 L                        |
      | CARBON         | Carbón vegetal                               |
      | trad 2         | Lejía Tradicional 2 L                        |
      | detergente     |                                              |

  @RN-CAT-12
  Escenario: Los más vendidos aparecen primero en la búsqueda
    Dado los productos:
      | nombre                 | categoría               | unidad | compra | venta | mínimo | stock |
      | Lejía Tradicional 1 L  | Lejías y desinfectantes | UNIDAD | 2.40   | 3.50  | 3      | 20    |
      | Lejía Tradicional 2 L  | Lejías y desinfectantes | UNIDAD | 4.30   | 6.20  | 3      | 20    |
    Y vendo "1" de "Lejía Tradicional 1 L"
    Y vendo "4" de "Lejía Tradicional 2 L"
    Y vendo "2" de "Lejía Tradicional 2 L"
    Cuando busco "lejia"
    Entonces los resultados son "Lejía Tradicional 2 L, Lejía Tradicional 1 L"

  @RN-CAT-16
  Escenario: "Se acaban" reúne los agotados y los que quedan poco
    Dado los productos:
      | nombre    | categoría | unidad | compra | venta | mínimo | stock |
      | Lejía 1 L | Otros     | UNIDAD | 2.40   | 3.50  | 3      | 0     |
      | Carbón    | Otros     | KILO   | 2.75   | 4.00  | 3      | 2     |
      | Bolsas    | Otros     | UNIDAD | 0.05   | 0.10  | 50     | 200   |
    Cuando filtro los productos por "Se acaban"
    Entonces los resultados son "Carbón, Lejía 1 L"

  @RN-CAT-14
  Escenario: La foto se reduce y se comprime
    Cuando agrego al producto una foto de 4000 x 3000 px
    Entonces la foto guardada mide como máximo 512 px en su lado mayor
    Y la foto guardada pesa como máximo 100 KB

  @RN-CAT-15
  Escenario: Una categoría con productos no se puede eliminar
    Dado los productos:
      | nombre | categoría | unidad | compra | venta | mínimo | archivado |
      | Escoba | Otros     | UNIDAD | 6.00   | 9.00  | 2      | sí        |
    Cuando elimino la categoría "Otros"
    Entonces el resultado es "error: La categoría tiene productos. Puedes cambiarle el nombre"

  @RN-CAT-15
  Escenario: El nombre de categoría no se repite
    Cuando creo la categoría "carbon y combustibles"
    Entonces el resultado es "error: Ya existe una categoría con ese nombre"
