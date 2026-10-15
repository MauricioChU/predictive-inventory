# language: es
Característica: Alertas de stock
  Para no quedarme sin productos
  como usuario principal
  quiero que la app me avise cuando algo se acaba, sin repetirme lo mismo a cada rato

  Antecedentes:
    Dado que hoy es "2026-10-15 10:00"
    Y la configuración tiene "7" días entre compras y "3" días de anticipación
    Y las notificaciones del sistema están permitidas

  @RN-AL-01
  Esquema del escenario: El estado depende del stock y del stock mínimo
    Dado los productos:
      | nombre    | categoría | unidad | compra | venta | mínimo | stock     |
      | Lejía 1 L | Otros     | UNIDAD | 2.40   | 3.50  | 3      | <stock>   |
    Y "Lejía 1 L" no tiene predicción
    Entonces el estado de "Lejía 1 L" es "<estado>"

    Ejemplos:
      | stock | estado       |
      | 0     | AGOTADO      |
      | 1     | POR_ACABARSE |
      | 3     | POR_ACABARSE |
      | 4     | NORMAL       |

  @RN-AL-01
  Escenario: Con predicción, se avisa antes de llegar al mínimo
    Dado los productos:
      | nombre    | categoría | unidad | compra | venta | mínimo | stock |
      | Lejía 1 L | Otros     | UNIDAD | 2.40   | 3.50  | 3      | 6     |
    Y "Lejía 1 L" vendió "56" en los últimos "28" días válidos
    Entonces los días de cobertura de "Lejía 1 L" son "3"
    Y el estado de "Lejía 1 L" es "POR_ACABARSE"

  @RN-AL-01
  Escenario: Un producto archivado no tiene estado
    Dado los productos:
      | nombre | categoría | unidad | compra | venta | mínimo | archivado |
      | Escoba | Otros     | UNIDAD | 6.00   | 9.00  | 2      | sí        |
    Entonces "Escoba" no tiene estado de stock
    Y no hay avisos

  @RN-AL-02
  Escenario: Cambiar el stock mínimo re-evalúa el estado
    Dado los productos:
      | nombre    | categoría | unidad | compra | venta | mínimo | stock |
      | Lejía 1 L | Otros     | UNIDAD | 2.40   | 3.50  | 3      | 5     |
    Cuando cambio el stock mínimo de "Lejía 1 L" a "5"
    Entonces el estado de "Lejía 1 L" es "POR_ACABARSE"

  @RN-AL-02
  Escenario: Al abrir la app se re-evalúa la predicción aunque no haya ventas nuevas
    Dado los productos:
      | nombre    | categoría | unidad | compra | venta | mínimo | stock |
      | Lejía 1 L | Otros     | UNIDAD | 2.40   | 3.50  | 1      | 6     |
    Y el estado guardado de "Lejía 1 L" es "NORMAL"
    Y "Lejía 1 L" vendió "56" en los últimos "28" días válidos
    Cuando abro la app
    Entonces el estado de "Lejía 1 L" es "POR_ACABARSE"
    Y se envía la notificación "Queda poco: Lejía 1 L (6 unid., se acaba en ~3 días)"

  @RN-AL-03
  Escenario: Se avisa cuando el estado empeora
    Dado los productos:
      | nombre    | categoría | unidad | compra | venta | mínimo | stock |
      | Lejía 1 L | Otros     | UNIDAD | 2.40   | 3.50  | 3      | 5     |
    Cuando vendo "2" de "Lejía 1 L"
    Entonces se envía la notificación "Queda poco: Lejía 1 L (3 unid.)"

  @RN-AL-03
  Escenario: No se repite el aviso si el estado no mejora
    Dado los productos:
      | nombre    | categoría | unidad | compra | venta | mínimo | stock |
      | Lejía 1 L | Otros     | UNIDAD | 2.40   | 3.50  | 3      | 5     |
    Y vendo "2" de "Lejía 1 L"
    Cuando vendo "1" de "Lejía 1 L"
    Entonces se enviaron "1" notificaciones en total

  @RN-AL-03
  Escenario: Pasar de "queda poco" a "agotado" vuelve a avisar
    Dado los productos:
      | nombre    | categoría | unidad | compra | venta | mínimo | stock |
      | Lejía 1 L | Otros     | UNIDAD | 2.40   | 3.50  | 3      | 2     |
    Y el último aviso de "Lejía 1 L" fue "POR_ACABARSE"
    Cuando vendo "2" de "Lejía 1 L"
    Entonces se envía la notificación "Se acabó: Lejía 1 L"

  @RN-AL-04
  Escenario: Al reponer, el aviso se rearma
    Dado los productos:
      | nombre    | categoría | unidad | compra | venta | mínimo | stock |
      | Lejía 1 L | Otros     | UNIDAD | 2.40   | 3.50  | 3      | 0     |
    Y el último aviso de "Lejía 1 L" fue "AGOTADO"
    Cuando llega mercadería:
      | producto  | cantidad | costo |
      | Lejía 1 L | 10       | 2.40  |
    Y vendo "7" de "Lejía 1 L"
    Entonces se envía la notificación "Queda poco: Lejía 1 L (3 unid.)"

  @RN-AL-05
  Esquema del escenario: Cada estado se muestra con color, ícono y texto
    Entonces el estado "<estado>" se muestra con color "<color>", ícono "<ícono>" y texto "<texto>"

    Ejemplos:
      | estado       | color   | ícono        | texto      |
      | AGOTADO      | rojo    | círculo-x    | Agotado    |
      | POR_ACABARSE | naranja | advertencia  | Queda poco |
      | NORMAL       | verde   | check        | Bien       |

  @RN-AL-06
  Escenario: Inicio muestra cuántos productos necesitan atención
    Dado los productos:
      | nombre    | categoría | unidad | compra | venta | mínimo | stock |
      | Lejía 1 L | Otros     | UNIDAD | 2.40   | 3.50  | 3      | 0     |
      | Carbón    | Otros     | KILO   | 2.75   | 4.00  | 3      | 2     |
      | Bolsas    | Otros     | UNIDAD | 0.05   | 0.10  | 50     | 200   |
    Entonces Inicio muestra "1 agotado y 1 por acabarse"
    Y el botón "Control" muestra el número "2"

  @RN-AL-06
  Escenario: Sin permiso, los avisos quedan dentro de la app
    Dado que las notificaciones del sistema no están permitidas
    Y los productos:
      | nombre    | categoría | unidad | compra | venta | mínimo | stock |
      | Lejía 1 L | Otros     | UNIDAD | 2.40   | 3.50  | 3      | 5     |
    Cuando vendo "2" de "Lejía 1 L"
    Entonces no se envía ninguna notificación del sistema
    Y Inicio muestra "1 por acabarse"

  @RN-AL-07
  Escenario: Varios avisos a la vez se agrupan
    Dado los productos:
      | nombre    | categoría | unidad | compra | venta | mínimo | stock |
      | Lejía 1 L | Otros     | UNIDAD | 2.40   | 3.50  | 3      | 1     |
      | Carbón    | Otros     | KILO   | 2.75   | 4.00  | 3      | 0     |
      | Jabón     | Otros     | UNIDAD | 1.20   | 2.00  | 5      | 2     |
    Y ningún producto tiene avisos anteriores
    Cuando abro la app
    Entonces se envía la notificación "3 productos se están acabando"
    Y se enviaron "1" notificaciones en total
    Y al tocar la notificación se abre "Para comprar"

  @RN-AL-08
  Escenario: El permiso no se pide al abrir la app por primera vez
    Dado que es la primera vez que se abre la app
    Cuando abro la app
    Entonces no se pide permiso de notificaciones

  @RN-AL-08
  Escenario: El permiso se pide después de explicar para qué sirve
    Cuando abro la pantalla "Avisos en tu celular"
    Y toco "Sí, avísame"
    Entonces se pide permiso de notificaciones

  @RN-AL-09
  Escenario: Resumen del día al abrir la app por primera vez en el día
    Dado los productos:
      | nombre    | categoría | unidad | compra | venta | mínimo | stock |
      | Lejía 1 L | Otros     | UNIDAD | 2.40   | 3.50  | 3      | 0     |
      | Carbón    | Otros     | KILO   | 2.75   | 4.00  | 3      | 2     |
    Y ayer la ganancia neta fue "S/ 48.20"
    Cuando abro la app
    Entonces se muestra el resumen del día con "1 agotado", "1 por acabarse" y "Ayer ganaste S/ 48.20"
    Cuando cierro el resumen
    Y abro la app
    Entonces no se muestra el resumen del día
