# language: es
Característica: Calculadora de ejemplo

  Antecedentes:
    Dado que tengo "2" manzanas

  @RN-EJ-01
  Escenario: Sumar con una tabla
    Cuando recibo:
      | fruta   | cantidad |
      | manzana | 3        |
    Entonces tengo "5" manzanas

  Esquema del escenario: Sumar varias veces
    Cuando recibo "<n>" manzanas
    Entonces tengo "<total>" manzanas

    Ejemplos:
      | n | total |
      | 1 | 3     |
      | 4 | 6     |

  Escenario: Texto largo
    Cuando anoto:
      """
      Hola
      mundo
      """
    Entonces la nota tiene "2" líneas

  Escenario: Paso que nadie definió
    Cuando hago algo que no existe
