# language: es
Característica: Torre de control
  Para tomar buenas decisiones en la tienda
  como usuario principal y como administrador
  quiero ver cuánto gano, qué se acaba, qué comprar y qué se vende más

  Antecedentes:
    Dado que hoy es "2026-10-15 18:00"
    Y la configuración tiene "7" días entre compras y "3" días de anticipación
    Y los productos:
      | nombre              | categoría | unidad | compra | venta | mínimo |
      | Lejía 1 L           | Otros     | UNIDAD | 2.40   | 3.50  | 3      |
      | Carbón              | Otros     | KILO   | 2.75   | 4.00  | 3      |
      | Jabón               | Otros     | UNIDAD | 1.20   | 2.00  | 3      |
      | Bolsas              | Otros     | UNIDAD | 0.05   | 0.10  | 0      |
      | Detergente a granel | Otros     | KILO   | 5.30   | 7.90  | 2      |

  # ---------- Base de los cálculos ----------

  @RN-AN-01
  Escenario: Las operaciones anuladas no cuentan
    Dado que "Lejía 1 L" tiene stock inicial "20" desde "2026-08-01"
    Y vendo "2" de "Lejía 1 L"
    Y vendo "3" de "Lejía 1 L"
    Cuando anulo la última venta
    Entonces las ventas de hoy son "S/ 7.00"
    Y "Lejía 1 L" tiene "1" venta en los últimos 7 días

  @RN-AN-02
  Escenario: Ventas, ganancias, mermas y diferencias de conteo de un periodo
    Dado que "Lejía 1 L" tiene stock inicial "20" desde "2026-08-01"
    Y vendo "4" de "Lejía 1 L"
    Y registro una merma de "1" de "Lejía 1 L" con motivo "Se derramó"
    Y cuento "14" de "Lejía 1 L"
    Entonces el resumen de "Hoy" es:
      | concepto              | monto    |
      | Ventas                | S/ 14.00 |
      | Costo de lo vendido   | S/ 9.60  |
      | Ganancia bruta        | S/ 4.40  |
      | Pérdidas por merma    | S/ 2.40  |
      | Ganancia neta         | S/ 2.00  |
      | Diferencias de conteo | -S/ 2.40 |

  @RN-AN-03
  Esquema del escenario: Ventas por periodo
    Dado que "Lejía 1 L" tiene stock inicial "100" desde "2026-08-01"
    Y el historial de ventas:
      | fecha            | producto  | cantidad |
      | 2026-10-15 09:00 | Lejía 1 L | 3        |
      | 2026-10-14 17:00 | Lejía 1 L | 2        |
      | 2026-10-10 12:00 | Lejía 1 L | 1        |
      | 2026-09-25 12:00 | Lejía 1 L | 10       |
      | 2026-09-05 12:00 | Lejía 1 L | 1        |
    Entonces las ventas de "<periodo>" son "<ventas>"

    Ejemplos:
      | periodo            | ventas   |
      | Hoy                | S/ 10.50 |
      | Ayer               | S/ 7.00  |
      | Últimos 7 días     | S/ 21.00 |
      | Últimos 30 días    | S/ 56.00 |

  # ---------- Predicción ----------

  @RN-AN-04
  Escenario: Venta promedio diaria con 28 días válidos
    Dado que "Lejía 1 L" tiene su primer movimiento el "2026-08-01"
    Y "Lejía 1 L" vendió "56" entre "2026-09-17" y "2026-10-14"
    Entonces la venta promedio diaria de "Lejía 1 L" es "2"

  @RN-AN-04
  Escenario: Los días agotado todo el día no cuentan
    Dado que "Lejía 1 L" tiene su primer movimiento el "2026-08-01"
    Y "Lejía 1 L" vendió "40" entre "2026-09-17" y "2026-10-14"
    Y "Lejía 1 L" estuvo agotado todo el día durante "8" días entre "2026-09-17" y "2026-10-14"
    Entonces los días válidos de "Lejía 1 L" son "20"
    Y la venta promedio diaria de "Lejía 1 L" es "2"

  @RN-AN-04
  Escenario: Un producto nuevo usa solo los días desde su primer movimiento
    Dado que "Jabón" tiene su primer movimiento el "2026-10-05"
    Y "Jabón" vendió "15" entre "2026-10-05" y "2026-10-14"
    Entonces los días válidos de "Jabón" son "10"
    Y la venta promedio diaria de "Jabón" es "1.5"

  @RN-AN-04
  Escenario: Con menos de 7 días válidos no hay predicción
    Dado que "Jabón" tiene su primer movimiento el "2026-10-10"
    Y "Jabón" vendió "6" entre "2026-10-10" y "2026-10-14"
    Entonces "Jabón" no tiene predicción

  @RN-AN-04
  Escenario: Las ventas de hoy no entran en el promedio
    Dado que "Lejía 1 L" tiene su primer movimiento el "2026-08-01"
    Y "Lejía 1 L" vendió "56" entre "2026-09-17" y "2026-10-14"
    Y vendo "5" de "Lejía 1 L"
    Entonces la venta promedio diaria de "Lejía 1 L" es "2"

  @RN-AN-05
  Esquema del escenario: Días de cobertura
    Dado que "<producto>" tiene stock "<stock>" y venta promedio diaria "<vpd>"
    Entonces "<producto>" muestra "<texto>"

    Ejemplos:
      | producto  | stock | vpd  | texto                               |
      | Lejía 1 L | 5     | 2    | Se acaba en ~2 días                 |
      | Lejía 1 L | 1     | 2    | Se acaba hoy                        |
      | Carbón    | 7     | 0.75 | Se acaba en ~9 días                 |
      | Lejía 1 L | 10    | 0    | Sin ventas en las últimas 4 semanas |

  # ---------- Lista para comprar ----------

  @RN-AN-06 @RN-AN-07 @RN-AN-08
  Escenario: Lista para comprar con cantidades sugeridas, orden y costo total
    Dado el estado de los productos:
      | producto            | stock | vpd        |
      | Lejía 1 L           | 5     | 2          |
      | Carbón              | 7     | 0.75       |
      | Jabón               | 2     | sin predicción |
      | Bolsas              | 0     | sin predicción |
      | Detergente a granel | 20    | 0.5        |
    Entonces la lista para comprar es:
      | producto  | estado       | sugerido | costo   |
      | Bolsas    | AGOTADO      | 1 unid.  | S/ 0.05 |
      | Lejía 1 L | POR_ACABARSE | 12 unid. | S/ 28.80 |
      | Jabón     | POR_ACABARSE | 4 unid.  | S/ 4.80 |
      | Carbón    | NORMAL       | 1.5 kg   | S/ 4.13 |
    Y el total estimado es "S/ 37.78"

  @RN-AN-06
  Esquema del escenario: La cantidad sugerida se redondea hacia arriba según la unidad
    Dado que "<producto>" tiene stock "<stock>", stock mínimo "<mínimo>" y venta promedio diaria "<vpd>"
    Entonces la cantidad sugerida de "<producto>" es "<sugerido>"

    Ejemplos:
      | producto  | stock | mínimo | vpd  | sugerido |
      | Lejía 1 L | 5     | 3      | 2    | 12 unid. |
      | Lejía 1 L | 4     | 3      | 1.6  | 11 unid. |
      | Carbón    | 7     | 3      | 0.75 | 1.5 kg   |
      | Carbón    | 6.4   | 3      | 0.5  | 0.5 kg   |

  @RN-AN-08
  Escenario: Compartir la lista como texto
    Dado que el nombre de la tienda es "Bodega Rosita"
    Y la lista para comprar tiene:
      | producto  | sugerido |
      | Lejía 1 L | 12       |
      | Carbón    | 1.5      |
    Cuando comparto la lista
    Entonces el texto compartido es:
      """
      Lista de compras – Bodega Rosita – 15/10/2026
      • Lejía 1 L: 12 unid.
      • Carbón: 1.5 kg
      Total estimado: S/ 32.93
      """

  @RN-AN-08
  Escenario: Los cambios a la lista se recuerdan hasta el final del día
    Dado que la lista para comprar tiene:
      | producto  | sugerido |
      | Lejía 1 L | 12       |
    Cuando cambio la cantidad de "Lejía 1 L" en la lista a "24"
    Y abro la app
    Entonces la cantidad de "Lejía 1 L" en la lista es "24"
    Cuando pasa al día "2026-10-16 08:00"
    Entonces la cantidad de "Lejía 1 L" en la lista es "12"

  @RN-AN-08
  Escenario: Convertir la lista en llegada de mercadería
    Dado que la lista para comprar tiene:
      | producto  | sugerido |
      | Lejía 1 L | 12       |
      | Carbón    | 1.5      |
    Cuando toco "Registrar llegada"
    Entonces se abre "Llegó mercadería" con:
      | producto  | cantidad | costo |
      | Lejía 1 L | 12       | 2.40  |
      | Carbón    | 1.5      | 2.75  |

  # ---------- Observaciones ----------

  @RN-AN-09
  Escenario: Más vendidos por veces vendido y por ganancia
    Dado que todos los productos tienen stock inicial "100" desde "2026-08-01"
    Y el historial de ventas:
      | fecha            | producto  | cantidad |
      | 2026-10-10 10:00 | Lejía 1 L | 1        |
      | 2026-10-11 10:00 | Lejía 1 L | 1        |
      | 2026-10-12 10:00 | Lejía 1 L | 1        |
      | 2026-10-13 10:00 | Lejía 1 L | 1        |
      | 2026-10-14 10:00 | Lejía 1 L | 1        |
      | 2026-10-12 11:00 | Carbón    | 5        |
      | 2026-10-14 11:00 | Carbón    | 5        |
      | 2026-10-11 12:00 | Jabón     | 1        |
      | 2026-10-13 12:00 | Jabón     | 1        |
      | 2026-10-15 12:00 | Jabón     | 1        |
    Entonces los más vendidos por veces en "7 días" son:
      | producto  | veces | cantidad |
      | Lejía 1 L | 5     | 5 unid.  |
      | Jabón     | 3     | 3 unid.  |
      | Carbón    | 2     | 10 kg    |
    Y los más vendidos por ganancia en "7 días" son:
      | producto  | ganancia |
      | Carbón    | S/ 12.50 |
      | Lejía 1 L | S/ 5.50  |
      | Jabón     | S/ 2.40  |

  @RN-AN-10
  Escenario: Precios para revisar
    Dado los productos:
      | nombre      | categoría | unidad | compra | venta | mínimo |
      | Cera roja   | Otros     | UNIDAD | 5.00   | 4.50  | 2      |
      | Desatorador | Otros     | UNIDAD | 3.00   | 3.00  | 2      |
    Entonces los precios para revisar son:
      | producto    | pérdida por unidad |
      | Cera roja   | S/ 0.50            |
      | Desatorador | S/ 0.00            |

  @RN-AN-11
  Escenario: Productos parados con dinero inmovilizado
    Dado los productos:
      | nombre     | categoría | unidad | compra | venta | mínimo |
      | Escoba     | Otros     | UNIDAD | 6.00   | 9.00  | 1      |
      | Trapeador  | Otros     | UNIDAD | 8.00   | 12.00 | 1      |
      | Recogedor  | Otros     | UNIDAD | 3.00   | 5.00  | 1      |
    Y que "Escoba" tiene stock inicial "5" desde "2026-07-17"
    Y el historial de ventas:
      | fecha            | producto  | cantidad |
      | 2026-08-31 10:00 | Escoba    | 1        |
    Y que "Trapeador" tiene stock inicial "2" desde "2026-09-05"
    Y que "Recogedor" tiene stock inicial "3" desde "2026-10-05"
    Y que "Lejía 1 L" tiene stock inicial "20" desde "2026-08-01"
    Y el historial de ventas:
      | fecha            | producto  | cantidad |
      | 2026-10-14 10:00 | Lejía 1 L | 1        |
    Entonces los productos parados son:
      | producto  | stock   | dinero inmovilizado |
      | Escoba    | 4 unid. | S/ 24.00            |
      | Trapeador | 2 unid. | S/ 16.00            |
    Y el total inmovilizado es "S/ 40.00"

  @RN-AN-12
  Escenario: Semana contra semana
    Dado que entre "2026-10-01" y "2026-10-07" se vendió "S/ 312.50" con ganancia neta "S/ 100.00"
    Y que entre "2026-10-08" y "2026-10-14" se vendió "S/ 350.00" con ganancia neta "S/ 90.00"
    Y que hoy se vendió "S/ 80.00"
    Entonces la comparación semanal muestra:
      | concepto      | esta semana | semana anterior | cambio      |
      | Ventas        | S/ 350.00   | S/ 312.50       | ▲ 12 % más  |
      | Ganancia neta | S/ 90.00    | S/ 100.00       | ▼ 10 % menos |

  @RN-AN-12
  Escenario: Sin datos de la semana anterior
    Dado que entre "2026-10-08" y "2026-10-14" se vendió "S/ 350.00" con ganancia neta "S/ 90.00"
    Y la tienda tiene su primera operación el "2026-10-08"
    Entonces la comparación semanal muestra "Sin datos de la semana anterior"

  @RN-AN-13
  Escenario: Mejor día de la semana
    Dado que la tienda tiene su primera operación el "2026-08-01"
    Y en los 56 días completos anteriores a hoy se vendió "S/ 100.00" cada día, "S/ 200.00" cada sábado y nada los domingos
    Entonces el promedio de ventas por día de la semana es:
      | día       | promedio  |
      | lunes     | S/ 100.00 |
      | martes    | S/ 100.00 |
      | miércoles | S/ 100.00 |
      | jueves    | S/ 100.00 |
      | viernes   | S/ 100.00 |
      | sábado    | S/ 200.00 |
      | domingo   | S/ 0.00   |
    Y el mejor día es "sábado"

  @RN-AN-13
  Escenario: Con menos de 14 días de historia no se calcula el mejor día
    Dado que la tienda tiene su primera operación el "2026-10-05"
    Entonces se muestra "Necesito al menos 2 semanas de ventas para saberlo"

  @RN-AN-14
  Escenario: Tendencia de 8 semanas del producto
    Dado que "Lejía 1 L" tiene stock inicial "500" desde "2026-08-01"
    Y "Lejía 1 L" vendió por bloques de 7 días completos, del más antiguo al más reciente: "10, 12, 9, 14, 15, 13, 16, 18"
    Entonces la tendencia de "Lejía 1 L" es "10, 12, 9, 14, 15, 13, 16, 18"

  @RN-AN-15
  Escenario: La Torre de control funciona sin internet
    Dado que no hay conexión a internet
    Y que "Lejía 1 L" tiene stock inicial "20" desde "2026-08-01"
    Y vendo "2" de "Lejía 1 L"
    Entonces la Torre de control muestra las secciones "Resumen, Atención, Para comprar, Más vendidos, Semana contra semana, Mejor día de la semana, Productos parados"
    Y las ventas de hoy son "S/ 7.00"

  # ---------- Antes de comprar ----------

  @RN-AN-16
  Esquema del escenario: ¿Necesito comprar? responde con una sola frase
    Dado que "<producto>" tiene stock "<stock>" y venta promedio diaria "<vpd>"
    Cuando pregunto si necesito comprar "<producto>"
    Entonces la respuesta es "<respuesta>"

    Ejemplos:
      | producto            | stock | vpd            | respuesta                                                                    |
      | Lejía 1 L           | 5     | 2              | Sí, compra ~12 unid. (S/ 28.80)                                              |
      | Detergente a granel | 20    | 0.5            | No hace falta: te alcanza para ~40 días                                      |
      | Jabón               | 10    | sin predicción | Tienes 10 unid. Todavía no sé cuánto vendes; vuelve a preguntar en unos días |

  @RN-AN-16
  Escenario: ¿Necesito comprar? un producto parado
    Dado los productos:
      | nombre | categoría | unidad | compra | venta | mínimo |
      | Escoba | Otros     | UNIDAD | 6.00   | 9.00  | 1      |
    Y que "Escoba" tiene stock inicial "5" desde "2026-07-17"
    Y el historial de ventas:
      | fecha            | producto | cantidad |
      | 2026-08-31 10:00 | Escoba   | 1        |
    Cuando pregunto si necesito comprar "Escoba"
    Entonces la respuesta es "No compres: no se vende hace 45 días y tienes 4 unid."

  # ---------- Alquiler del local ----------

  @RN-AN-17
  Escenario: El costo del local empieza sin configurar
    Entonces la tarjeta del alquiler pregunta "¿Pagas alquiler por tu local?" con el botón "Configurar"

  @RN-AN-17
  Esquema del escenario: Validación del costo del local
    Cuando configuro el local con pago "<frecuencia>", monto "<monto>" y días "<días>"
    Entonces el resultado es "<resultado>"

    Ejemplos:
      | frecuencia       | monto    | días  | resultado                                      |
      | Una vez al mes   | 1200.00  | 5     | ok                                             |
      | Dos veces al mes | 600.00   | 20, 5 | ok                                             |
      | Una vez al mes   | 0.00     | 5     | error: El monto debe ser mayor que S/ 0.00     |
      | Una vez al mes   | 12.345   | 5     | error: El monto puede tener hasta 2 decimales  |
      | Una vez al mes   | 1200.00  | 32    | error: El día de pago va del 1 al 31           |
      | Dos veces al mes | 600.00   | 5, 5  | error: Elige dos días distintos                |

  @RN-AN-17
  Escenario: Sin alquiler no se muestra la tarjeta
    Cuando configuro el local con "No pago (el local es mío)"
    Entonces no se muestra la tarjeta del alquiler

  @RN-AN-18
  Esquema del escenario: Último y próximo pago
    Dado que hoy es "<hoy> 10:00"
    Y el local se paga "<frecuencia>" los días "<días>"
    Entonces el último pago es "<último>" y el próximo pago es "<próximo>"

    Ejemplos:
      | hoy        | frecuencia       | días  | último     | próximo    |
      | 2026-10-15 | Dos veces al mes | 5, 20 | 2026-10-05 | 2026-10-20 |
      | 2026-10-20 | Dos veces al mes | 5, 20 | 2026-10-20 | 2026-11-05 |
      | 2026-11-03 | Dos veces al mes | 5, 20 | 2026-10-20 | 2026-11-05 |
      | 2027-02-15 | Una vez al mes   | 31    | 2027-01-31 | 2027-02-28 |
      | 2027-03-01 | Una vez al mes   | 31    | 2027-02-28 | 2027-03-31 |

  @RN-AN-19
  Escenario: La tarjeta muestra cuánto falta para cubrir el local
    Dado que "Lejía 1 L" tiene stock inicial "500" desde "2026-08-01"
    Y el local se paga "S/ 600.00" "Dos veces al mes" los días "5, 20"
    Y el historial de ventas:
      | fecha            | producto  | cantidad |
      | 2026-10-04 12:00 | Lejía 1 L | 10       |
      | 2026-10-06 12:00 | Lejía 1 L | 100      |
    Entonces la tarjeta del alquiler dice "Para el pago del 20/10 llevas S/ 110.00 de S/ 600.00"
    Y la tarjeta del alquiler dice "Te falta S/ 490.00"
    Y la barra del alquiler está en "18" %

  @RN-AN-19
  Escenario: La tarjeta avisa cuando el local ya está cubierto
    Dado que "Lejía 1 L" tiene stock inicial "500" desde "2026-08-01"
    Y el local se paga "S/ 100.00" "Dos veces al mes" los días "5, 20"
    Y el historial de ventas:
      | fecha            | producto  | cantidad |
      | 2026-10-06 12:00 | Lejía 1 L | 100      |
    Entonces la tarjeta del alquiler dice "✓ Ya cubriste el local del 20/10"
    Y la tarjeta del alquiler dice "Lo que ganes de más es tuyo: llevas S/ 10.00"
    Y la barra del alquiler está en "100" %

  @RN-AN-19
  Escenario: Con pérdidas en el periodo la barra queda en cero
    Dado que "Lejía 1 L" tiene stock inicial "500" desde "2026-08-01"
    Y el local se paga "S/ 600.00" "Una vez al mes" los días "5"
    Y registro una merma de "10" de "Lejía 1 L" con motivo "Se derramó"
    Entonces la tarjeta del alquiler dice "Para el pago del 05/11 llevas -S/ 24.00 de S/ 600.00"
    Y la tarjeta del alquiler dice "Te falta S/ 624.00"
    Y la barra del alquiler está en "0" %
