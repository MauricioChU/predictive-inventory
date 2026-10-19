# language: es
Característica: Respaldo, Excel e importación
  Para no perder nunca mis datos y poder revisarlos fuera del celular
  como administrador
  quiero exportar a Excel, guardar copias, restaurarlas e importar productos

  Antecedentes:
    Dado que hoy es "2026-10-15 20:30"
    Y que el nombre de la tienda es "Bodega Rosita"
    Y los productos:
      | nombre    | categoría | unidad | compra | venta | mínimo | stock |
      | Lejía 1 L | Otros     | UNIDAD | 2.40   | 3.50  | 3      | 10    |
      | Carbón    | Otros     | KILO   | 2.75   | 4.00  | 3      | 12.5  |

  @RN-RE-01
  Escenario: Exportar el inventario a Excel
    Dado que vendo "2" de "Lejía 1 L"
    Cuando exporto a Excel
    Entonces se genera el archivo "inventario-bodega-rosita-2026-10-15.xlsx"
    Y el archivo tiene las hojas "Productos, Movimientos, Resumen diario"
    Y la hoja "Productos" tiene la fila:
      | nombre    | unidad | precio de compra | precio de venta | stock | stock mínimo | estado de stock |
      | Lejía 1 L | unid.  | 2.40             | 3.50            | 8     | 3            | Bien            |
    Y la hoja "Movimientos" tiene "3" filas
    Y la hoja "Resumen diario" tiene la fila:
      | fecha      | ventas | ganancia bruta | mermas | ganancia neta |
      | 15/10/2026 | 7.00   | 2.20           | 0.00   | 2.20          |

  @RN-RE-02
  Escenario: Guardar una copia completa
    Cuando guardo una copia
    Entonces se genera el archivo "respaldo-bodega-rosita-2026-10-15-2030.json"
    Y la copia tiene versión de formato "2"
    Y el control de la copia indica "2" productos y "2" operaciones
    Y el control de la copia indica stock "12.5" para "Carbón"
    Y la copia no incluye existencias ni resúmenes diarios

  @RN-RE-03
  Escenario: Restaurar una copia reemplaza los datos tras dos confirmaciones
    Dado una copia guardada con "152" productos y "3840" operaciones del "2026-10-01" al "2026-12-15"
    Cuando restauro la copia
    Entonces se muestra "152 productos, 3 840 movimientos, del 01/10/2026 al 15/12/2026"
    Y se pide confirmar "2" veces
    Cuando confirmo las dos veces
    Entonces el catálogo tiene "152" productos

  @RN-RE-03
  Escenario: Una copia dañada no toca los datos actuales
    Dado un archivo de copia dañado
    Cuando restauro la copia
    Entonces el resultado es "error: Este archivo no es una copia válida de la app"
    Y el catálogo tiene "2" productos
    Y el stock de "Lejía 1 L" es "10"

  @RN-RE-04
  Escenario: Si el control no coincide al restaurar, se revierte
    Dado una copia guardada cuyo control indica stock "99" para "Carbón" pero sus operaciones suman "12.5"
    Cuando restauro la copia y confirmo las dos veces
    Entonces el resultado es "error: La copia tiene datos que no cuadran. No se cambió nada"
    Y el catálogo tiene "2" productos

  @RN-RE-04
  Escenario: Al restaurar se reconstruyen las existencias
    Dado una copia guardada de esta tienda
    Y que luego vendo "5" de "Lejía 1 L"
    Cuando restauro la copia y confirmo las dos veces
    Entonces el stock de "Lejía 1 L" es "10"
    Y el stock de "Lejía 1 L" es igual a la suma de sus movimientos

  @RN-RE-05
  Escenario: Una copia de una versión más nueva se rechaza
    Dado una copia con versión de formato "3"
    Cuando restauro la copia
    Entonces el resultado es "error: Actualiza la app para abrir este respaldo"

  @RN-RE-06
  Esquema del escenario: Recordatorio de copia
    Dado que el almacenamiento persistente está concedido
    Y que la última copia fue <cuándo>
    Cuando abro la app
    Entonces Inicio <muestra>

    Ejemplos:
      | cuándo           | muestra                                              |
      | nunca            | muestra "Todavía no guardas una copia de tus datos" |
      | hace 6 días      | no muestra recordatorio de copia                     |
      | hace 7 días      | muestra "Hace 7 días que no guardas una copia"       |
      | hace 30 días     | muestra "Hace 30 días que no guardas una copia"      |

  @RN-RE-07
  Escenario: Importar productos desde Excel con vista previa
    Dado un Excel de productos con las filas:
      | fila | nombre           | categoría        | unidad | precio de compra | precio de venta | stock mínimo | stock inicial |
      | 2    | Jabón Bolívar    | Detergentes      | unid   | 1.20             | 2.00            | 5            | 24            |
      | 3    | Ambientador Glade | Ambientadores    | unid   | 6.50             | 9.00            | 2            | 6             |
      | 4    | Cera roja        | Limpiadores      | L      | 8.00             |                 | 1            |               |
      | 5    | Bolsas chicas    | Bolsas           | unid   | 0.05             | 0.10            | 1.5          | 100           |
    Cuando cargo el Excel
    Entonces la vista previa muestra "2" filas válidas y "2" filas con problema
    Y la vista previa explica:
      | fila | problema                                            |
      | 4    | Fila 4: falta el precio de venta                    |
      | 5    | Fila 5: Bolsas chicas se cuenta por unidades enteras |
    Cuando confirmo la importación
    Entonces el catálogo tiene "4" productos
    Y el stock de "Jabón Bolívar" es "24"

  @RN-RE-07
  Escenario: Descargar la plantilla de importación
    Cuando descargo la plantilla de productos
    Entonces el archivo tiene las columnas "nombre, categoría, unidad, precio de compra, precio de venta, stock mínimo, stock inicial"

  @RN-RE-08
  Escenario: Repetidos contra el catálogo o dentro del archivo se rechazan, y las categorías nuevas se crean
    Dado un Excel de productos con las filas:
      | fila | nombre      | categoría   | unidad | precio de compra | precio de venta | stock mínimo | stock inicial |
      | 2    | lejia 1 l   | Otros       | unid   | 2.40             | 3.50            | 3            |               |
      | 3    | Detergente  | Detergentes | kg     | 5.30             | 7.90            | 2            | 10            |
      | 4    | detergente  | Detergentes | kg     | 5.30             | 7.90            | 2            |               |
    Cuando cargo el Excel
    Entonces la vista previa explica:
      | fila | problema                                          |
      | 2    | Fila 2: ya existe un producto llamado "Lejía 1 L" |
      | 4    | Fila 4: "detergente" está repetido en la fila 3   |
    Cuando confirmo la importación
    Entonces existe la categoría "Detergentes"
    Y existe una operación "STOCK_INICIAL" de "10" para "Detergente" con costo "5.30"

  @RN-RE-09
  Escenario: Se pide almacenamiento persistente en el primer uso
    Dado que es la primera vez que se abre la app
    Cuando abro la app
    Entonces se solicita almacenamiento persistente

  @RN-RE-09
  Escenario: Sin almacenamiento persistente el recordatorio es más frecuente
    Dado que el almacenamiento persistente fue rechazado
    Y que la última copia fue hace 3 días
    Cuando abro la app
    Entonces Inicio muestra "Hace 3 días que no guardas una copia"

  @RN-RE-10
  Escenario: Restaurar una copia desde la bienvenida completa la primera vez
    Dado que la primera vez no está completada
    Y una copia guardada con "152" productos y "3840" operaciones del "2026-10-01" al "2026-12-15"
    Cuando elijo "Ya tengo una copia guardada" en la bienvenida
    Y restauro la copia
    Y confirmo las dos veces
    Entonces la primera vez está completada
    Y el catálogo tiene "152" productos

  @RN-RE-10
  Escenario: Cancelar la restauración vuelve a la bienvenida
    Dado que la primera vez no está completada
    Cuando elijo "Ya tengo una copia guardada" en la bienvenida
    Y cancelo la restauración
    Entonces la primera vez no está completada
    Y se muestra la bienvenida

  @RN-RE-11
  Escenario: Una copia de la versión 1 se abre con el local sin configurar
    Dado una copia con versión de formato "1"
    Cuando restauro la copia
    Y confirmo las dos veces
    Entonces el costo del local está sin configurar

  @RN-RE-11
  Escenario: La copia guarda el costo del local
    Dado el local se paga "S/ 600.00" "Dos veces al mes" los días "5, 20"
    Cuando guardo una copia y la restauro
    Entonces el local se paga "S/ 600.00" "Dos veces al mes" los días "5, 20"
