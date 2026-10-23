# language: es
Característica: Operaciones de stock
  Para que el stock sea siempre real
  como usuario principal
  quiero registrar ventas, llegadas de mercadería, mermas y conteos, y poder corregirlos

  Antecedentes:
    Dado que hoy es "2026-10-15 10:00"
    Y los productos:
      | nombre              | categoría | unidad | compra | venta | mínimo | stock |
      | Lejía 1 L           | Otros     | UNIDAD | 2.40   | 3.50  | 3      | 10    |
      | Carbón              | Otros     | KILO   | 2.75   | 4.00  | 3      | 10    |
      | Detergente a granel | Otros     | KILO   | 5.30   | 7.90  | 2      | 5     |

  @RN-OP-01
  Escenario: El stock es la suma de las operaciones registradas
    Cuando vendo "3" de "Lejía 1 L"
    Y llega mercadería:
      | producto  | cantidad | costo |
      | Lejía 1 L | 6        | 2.40  |
    Entonces el stock de "Lejía 1 L" es "13"
    Y el historial de "Lejía 1 L" tiene las operaciones "STOCK_INICIAL, VENTA, INGRESO"
    Y el stock de "Lejía 1 L" es igual a la suma de sus movimientos

  @RN-OP-02
  Escenario: Corregir una venta no la borra: se anula
    Dado que vendo "2" de "Lejía 1 L"
    Cuando anulo la última venta
    Entonces el historial de "Lejía 1 L" tiene las operaciones "STOCK_INICIAL, VENTA, ANULACION"
    Y la venta aparece como anulada
    Y el stock de "Lejía 1 L" es "10"

  @RN-OP-03
  Esquema del escenario: La cantidad de cada línea debe ser mayor que 0 y razonable
    Cuando vendo "<cantidad>" de "Carbón"
    Entonces el resultado es "<resultado>"

    Ejemplos:
      | cantidad | resultado                                   |
      | 1        | registrada                                  |
      | 0        | error: La cantidad debe ser mayor que 0     |
      | -2       | error: La cantidad debe ser mayor que 0     |
      | 100000   | error: La cantidad no puede pasar de 99 999 |

  @RN-OP-04
  Esquema del escenario: La precisión depende de la unidad del producto
    Cuando vendo "<cantidad>" de "<producto>"
    Entonces el resultado es "<resultado>"

    Ejemplos:
      | producto  | cantidad | resultado                                           |
      | Lejía 1 L | 2        | registrada                                          |
      | Lejía 1 L | 1.5      | error: Este producto se cuenta por unidades enteras |
      | Carbón    | 1.25     | registrada                                          |
      | Carbón    | 0.125    | registrada                                          |
      | Carbón    | 0.0005   | error: Usa como máximo tres decimales              |

  @RN-OP-05
  Escenario: No se puede vender más de lo que hay
    Cuando vendo "11" de "Lejía 1 L"
    Entonces el resultado es "error: Solo quedan 10 unid. de Lejía 1 L"
    Y el stock de "Lejía 1 L" es "10"

  @RN-OP-05 @RN-OP-06
  Escenario: Si una línea no alcanza, no se registra ninguna
    Cuando vendo:
      | producto  | cantidad |
      | Lejía 1 L | 2        |
      | Carbón    | 20       |
    Entonces el resultado es "error: Solo quedan 10 kg de Carbón"
    Y el stock de "Lejía 1 L" es "10"
    Y el stock de "Carbón" es "10"

  @RN-OP-07
  Escenario: Agregar dos veces el mismo producto suma las cantidades
    Cuando agrego al carrito "1" de "Lejía 1 L"
    Y agrego al carrito "2" de "Lejía 1 L"
    Entonces el carrito tiene "1" línea
    Y la línea de "Lejía 1 L" tiene cantidad "3"

  @RN-OP-08
  Escenario: No se opera un producto archivado
    Dado los productos:
      | nombre | categoría | unidad | compra | venta | mínimo | archivado |
      | Escoba | Otros     | UNIDAD | 6.00   | 9.00  | 2      | sí        |
    Cuando llega mercadería:
      | producto | cantidad | costo |
      | Escoba   | 3        | 6.00  |
    Entonces el resultado es "error: Escoba está archivado. Reactívalo para usarlo"

  @RN-OP-09
  Esquema del escenario: La fecha puede ser hasta 7 días atrás, nunca futura
    Cuando vendo "1" de "Lejía 1 L" con fecha "<fecha>"
    Entonces el resultado es "<resultado>"

    Ejemplos:
      | fecha            | resultado                                        |
      | 2026-10-15 09:00 | registrada                                       |
      | 2026-10-14 18:30 | registrada                                       |
      | 2026-10-08 10:00 | registrada                                       |
      | 2026-10-07 23:59 | error: Solo puedes anotar hasta 7 días atrás     |
      | 2026-10-16 08:00 | error: La fecha no puede ser futura              |

  @RN-OP-10 @RN-OP-12
  Escenario: Una venta guarda precio y costo, y calcula total y ganancia por línea
    Cuando vendo:
      | producto            | cantidad |
      | Lejía 1 L           | 2        |
      | Carbón              | 1.25     |
      | Detergente a granel | 0.333    |
    Entonces la venta tiene estas líneas:
      | producto            | precio | costo | importe | ganancia |
      | Lejía 1 L           | 3.50   | 2.40  | 7.00    | 2.20     |
      | Carbón              | 4.00   | 2.75  | 5.00    | 1.56     |
      | Detergente a granel | 7.90   | 5.30  | 2.63    | 0.87     |
    Y el total de la venta es "S/ 14.63"
    Y la ganancia de la venta es "S/ 4.63"

  @RN-OP-11
  Escenario: Cambiar el precio solo para una venta
    Cuando vendo "2" de "Lejía 1 L" a precio especial "3.00"
    Entonces el total de la venta es "S/ 6.00"
    Y la ganancia de la venta es "S/ 1.20"
    Y el producto "Lejía 1 L" tiene precio de venta "3.50"

  @RN-OP-11 @RN-OP-07
  Escenario: Parte de las unidades a otro precio quedan en su propia línea
    Cuando vendo "4" de "Lejía 1 L" y "1" más a precio especial "3.00"
    Entonces el total de la venta es "S/ 17.00"
    Y el stock de "Lejía 1 L" es "5"

  @RN-OP-11 @RN-OP-05
  Escenario: Las dos líneas del mismo producto juntas no pueden pasar el stock
    Cuando vendo "8" de "Lejía 1 L" y "3" más a precio especial "3.00"
    Entonces el resultado es "error: Solo quedan 10 unid. de Lejía 1 L"
    Y el stock de "Lejía 1 L" es "10"

  @RN-OP-11
  Escenario: El precio especial debe ser mayor que cero
    Cuando vendo "2" de "Lejía 1 L" a precio especial "0.00"
    Entonces el resultado es "error: El precio de venta debe ser mayor que S/ 0.00"

  @RN-OP-22
  Esquema del escenario: El panel de venta muestra cuántas unidades quedan tras la venta
    Cuando pongo "<cantidad>" de "<producto>" en el panel de venta
    Entonces se muestra "<mensaje>"

    Ejemplos:
      | producto  | cantidad | mensaje        |
      | Lejía 1 L | 3        | Quedan 7 unid. |
      | Lejía 1 L | 9        | Queda 1 unid.  |
      | Lejía 1 L | 10       | Se acaba       |
      | Carbón    | 2.5      | Quedan 7.5 kg  |

  @RN-OP-22
  Escenario: Confirmar desde el panel registra la venta con Ahora
    Cuando vendo "2" de "Lejía 1 L"
    Entonces el stock de "Lejía 1 L" es "8"
    Y la venta ocurrió el "2026-10-15 10:00"

  @RN-OP-22
  Escenario: Con Otro día el panel registra la venta en el día y la hora elegidos
    Cuando vendo "1" de "Lejía 1 L" con fecha "2026-10-14 18:30"
    Entonces la venta ocurrió el "2026-10-14 18:30"

  @RN-OP-14
  Escenario: Si el costo de la mercadería cambió, se ofrece actualizar el precio de compra
    Cuando llega mercadería:
      | producto  | cantidad | costo |
      | Lejía 1 L | 12       | 2.60  |
    Entonces se pide confirmar con el mensaje "¿Actualizar el precio de compra a S/ 2.60? Ganarás S/ 0.90 por unidad"
    Cuando confirmo
    Entonces el stock de "Lejía 1 L" es "22"
    Y el producto "Lejía 1 L" tiene precio de compra "2.60"

  @RN-OP-14
  Escenario: Se puede registrar el costo distinto sin cambiar el precio de compra
    Cuando llega mercadería:
      | producto  | cantidad | costo |
      | Lejía 1 L | 12       | 2.60  |
    Y rechazo la confirmación
    Entonces el stock de "Lejía 1 L" es "22"
    Y el producto "Lejía 1 L" tiene precio de compra "2.40"

  @RN-OP-15
  Escenario: Una merma necesita motivo y cuenta como pérdida
    Cuando registro una merma de "2" de "Lejía 1 L" con motivo "Se derramó"
    Entonces el stock de "Lejía 1 L" es "8"
    Y las pérdidas por merma de hoy son "S/ 4.80"

  @RN-OP-15
  Esquema del escenario: Validación del motivo de merma
    Cuando registro una merma de "1" de "Lejía 1 L" con motivo "<motivo>" y nota "<nota>"
    Entonces el resultado es "<resultado>"

    Ejemplos:
      | motivo          | nota               | resultado                          |
      | Se venció       |                    | registrada                         |
      | Otro            | Se lo llevó un niño | registrada                        |
      | Otro            |                    | error: Cuéntanos qué pasó          |
      |                 |                    | error: Elige qué pasó con el producto |

  @RN-OP-16
  Escenario: Contar stock registra la diferencia
    Cuando cuento "8" de "Lejía 1 L"
    Entonces existe una operación "AJUSTE" de "-2" para "Lejía 1 L"
    Y el stock de "Lejía 1 L" es "8"
    Y las diferencias de conteo de hoy son "-S/ 4.80"
    Y la ganancia neta de hoy es "S/ 0.00"

  @RN-OP-16
  Escenario: Si el conteo coincide no se registra nada
    Cuando cuento "10" de "Lejía 1 L"
    Entonces se muestra "El stock ya estaba correcto"
    Y el historial de "Lejía 1 L" tiene las operaciones "STOCK_INICIAL"

  @RN-OP-17
  Escenario: Anular una venta devuelve el stock y la saca de las ganancias
    Dado que vendo "2" de "Lejía 1 L"
    Cuando anulo la última venta
    Entonces el stock de "Lejía 1 L" es "10"
    Y las ventas de hoy son "S/ 0.00"

  @RN-OP-17
  Escenario: Una operación solo se anula una vez
    Dado que vendo "2" de "Lejía 1 L"
    Y anulo la última venta
    Cuando anulo otra vez esa venta
    Entonces el resultado es "error: Esta operación ya fue anulada"

  @RN-OP-17
  Escenario: Una anulación no se puede anular
    Dado que vendo "2" de "Lejía 1 L"
    Y anulo la última venta
    Cuando anulo la última anulación
    Entonces el resultado es "error: Una anulación no se puede anular. Registra la operación de nuevo"

  @RN-OP-17
  Escenario: No se anula un ingreso cuya mercadería ya se vendió
    Dado que llega mercadería:
      | producto            | cantidad | costo |
      | Detergente a granel | 3        | 5.30  |
    Y vendo "7" de "Detergente a granel"
    Cuando anulo el último ingreso
    Entonces el resultado es "error: Solo queda 1 kg de Detergente a granel"

  @RN-OP-18
  Escenario: Deshacer justo después de registrar
    Dado que vendo "2" de "Lejía 1 L"
    Cuando pasan "5" segundos
    Entonces se ofrece "Deshacer"
    Cuando toco "Deshacer"
    Entonces el stock de "Lejía 1 L" es "10"
    Y la venta aparece como anulada

  @RN-OP-18
  Escenario: El botón Deshacer desaparece a los 10 segundos
    Dado que vendo "2" de "Lejía 1 L"
    Cuando pasan "11" segundos
    Entonces no se ofrece "Deshacer"

  @RN-OP-19
  Escenario: Revisar datos corrige una existencia que no cuadra
    Dado que la existencia guardada de "Carbón" fue alterada a "7"
    Cuando reviso los datos
    Entonces el stock de "Carbón" es "10"
    Y se informa "Corregimos el stock de 1 producto: Carbón (7 kg → 10 kg)"

  @RN-OP-20
  Escenario: Avisar cuando una compra alcanza para demasiados días
    Dado que "Lejía 1 L" tiene venta promedio diaria "2"
    Cuando llega mercadería:
      | producto  | cantidad | costo |
      | Lejía 1 L | 110      | 2.40  |
    Entonces se avisa de "Lejía 1 L": "Llegan 110 unid. → te alcanzan ~60 días" y "Te sugerimos ~7 unid."
    Y se ofrecen las opciones "Registrar igual, Cambiar cantidad"

  @RN-OP-20
  Escenario: El aviso dice si no hacía falta comprar
    Dado que "Carbón" tiene venta promedio diaria "0.25"
    Cuando llega mercadería:
      | producto | cantidad | costo |
      | Carbón   | 5        | 2.75  |
    Entonces se avisa de "Carbón": "Llegan 5 kg → te alcanzan ~60 días" y "No necesitabas comprar"

  @RN-OP-20
  Escenario: Avisar cuando se compra un producto parado
    Dado los productos:
      | nombre | categoría | unidad | compra | venta | mínimo |
      | Escoba | Otros     | UNIDAD | 6.00   | 9.00  | 1      |
    Y que "Escoba" tiene stock inicial "5" desde "2026-07-17"
    Y el historial de ventas:
      | fecha            | producto | cantidad |
      | 2026-08-31 10:00 | Escoba   | 1        |
    Cuando llega mercadería:
      | producto | cantidad | costo |
      | Escoba   | 2        | 6.00  |
    Entonces se avisa de "Escoba": "No se vende hace 45 días" y "Aún tienes 4 unid."

  @RN-OP-20
  Escenario: Una compra razonable no genera aviso
    Dado que "Lejía 1 L" tiene venta promedio diaria "2"
    Cuando llega mercadería:
      | producto  | cantidad | costo |
      | Lejía 1 L | 20       | 2.40  |
    Entonces no se muestra ningún aviso de sobrecompra
    Y el stock de "Lejía 1 L" es "30"

  @RN-OP-20
  Escenario: El aviso no bloquea el registro
    Dado que "Lejía 1 L" tiene venta promedio diaria "2"
    Cuando llega mercadería:
      | producto  | cantidad | costo |
      | Lejía 1 L | 110      | 2.40  |
    Y toco "Registrar igual"
    Entonces el stock de "Lejía 1 L" es "120"

  @RN-OP-21
  Escenario: El conteo guiado recorre los productos y resume al terminar
    Cuando empiezo a contar todo
    Entonces el producto a contar es "Carbón"
    Cuando respondo "10"
    Entonces el producto a contar es "Detergente a granel"
    Cuando salto el producto
    Entonces el producto a contar es "Lejía 1 L"
    Cuando respondo "8"
    Entonces existe una operación "AJUSTE" de "-2" para "Lejía 1 L"
    Y el resumen del conteo dice "Contaste 2 productos. 1 con diferencia: -S/ 4.80"
    Y el resumen del conteo dice "Te faltó contar 1: Detergente a granel"

  @RN-OP-21
  Escenario: El conteo guiado se puede seguir después
    Cuando empiezo a contar todo
    Y respondo "10"
    Y toco "Seguir después"
    Y abro la app
    Y continúo el conteo
    Entonces el producto a contar es "Detergente a granel"
    Y se muestra "Llevas 1 de 3"
