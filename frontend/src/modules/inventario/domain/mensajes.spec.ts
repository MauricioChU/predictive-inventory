import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import {
  mensajeCambioDePrecio,
  mensajeCompraExcesiva,
  mensajeDeRevisionDeDatos,
  mensajeDeSobrecompra,
  mensajeProductoParado,
  mensajeStockInsuficiente,
  progresoDelConteo,
  resumenDelConteo,
} from './mensajes'

const soles = (texto: string) => Dinero.deTexto(texto)
const kilos = (texto: string) => Cantidad.deTexto(texto, 'KILO')

describe('mensajeStockInsuficiente', () => {
  it('RN-OP-05: plural, singular y sin stock', () => {
    expect(mensajeStockInsuficiente('Lejía 1 L', 'UNIDAD', Cantidad.deEntero(10))).toBe(
      'Solo quedan 10 unid. de Lejía 1 L',
    )
    expect(mensajeStockInsuficiente('Lejía 1 L', 'UNIDAD', Cantidad.deEntero(2))).toBe(
      'Solo quedan 2 unid. de Lejía 1 L',
    )
    expect(mensajeStockInsuficiente('Detergente a granel', 'KILO', kilos('1'))).toBe(
      'Solo queda 1 kg de Detergente a granel',
    )
    expect(mensajeStockInsuficiente('Carbón', 'KILO', kilos('0.5'))).toBe(
      'Solo quedan 0.5 kg de Carbón',
    )
    expect(mensajeStockInsuficiente('Lejía 1 L', 'UNIDAD', Cantidad.cero())).toBe(
      'Ya no queda Lejía 1 L',
    )
  })
})

describe('mensajeCambioDePrecio', () => {
  it('RN-OP-14: con ganancia', () => {
    expect(mensajeCambioDePrecio(soles('2.60'), soles('3.50'), 'UNIDAD')).toBe(
      '¿Actualizar el precio de compra a S/ 2.60? Ganarás S/ 0.90 por unidad',
    )
  })

  it('RN-OP-14: con pérdida', () => {
    expect(mensajeCambioDePrecio(soles('4.20'), soles('4.00'), 'KILO')).toBe(
      '¿Actualizar el precio de compra a S/ 4.20? Perderás S/ 0.20 por kilo',
    )
  })

  it('RN-OP-14: sin ganancia, por litro', () => {
    expect(mensajeCambioDePrecio(soles('5.00'), soles('5.00'), 'LITRO')).toBe(
      '¿Actualizar el precio de compra a S/ 5.00? No ganarás nada por litro',
    )
  })
})

describe('mensajes de sobrecompra', () => {
  it('RN-OP-20: producto parado (sin punto final después de la cantidad)', () => {
    expect(mensajeProductoParado('Escoba', 45, Cantidad.deEntero(4), 'UNIDAD')).toBe(
      'Escoba no se vende hace 45 días y aún tienes 4 unid.',
    )
    expect(mensajeProductoParado('Carbón', 31, kilos('2'), 'KILO')).toBe(
      'Carbón no se vende hace 31 días y aún tienes 2 kg',
    )
  })

  it('RN-OP-20: compra excesiva con cantidad sugerida', () => {
    expect(mensajeCompraExcesiva('Lejía 1 L', 60, 'UNIDAD', Cantidad.deEntero(7))).toBe(
      'Con esto tendrías Lejía 1 L para ~60 días. Te sugerimos ~7 unid.',
    )
    expect(mensajeCompraExcesiva('Carbón', 40, 'KILO', kilos('1.5'))).toBe(
      'Con esto tendrías Carbón para ~40 días. Te sugerimos ~1.5 kg',
    )
  })

  it('RN-OP-20: compra excesiva sin necesidad de comprar', () => {
    expect(mensajeCompraExcesiva('Carbón', 60, 'KILO', null)).toBe(
      'Con esto tendrías Carbón para ~60 días. Ahora no necesitabas comprar.',
    )
  })
})

describe('mensajeDeSobrecompra', () => {
  const LEJIA = { nombre: 'Lejía 1 L', unidad: 'UNIDAD' as const }
  const CARBON = { nombre: 'Carbón', unidad: 'KILO' as const }
  const conVpd = (vendido: Cantidad, diasValidos: number) => ({ vendido, diasValidos })
  const lejiaConVpd2 = {
    stock: Cantidad.deEntero(10),
    prediccion: conVpd(Cantidad.deEntero(56), 28),
    enListaParaComprar: true,
    cantidadSugerida: Cantidad.deEntero(7),
    parado: null,
  }

  it('RN-OP-20: Lejía con VPD 2 y compra de 110 → ~60 días, con la cantidad sugerida', () => {
    expect(mensajeDeSobrecompra(LEJIA, lejiaConVpd2, Cantidad.deEntero(110), 30)).toBe(
      'Con esto tendrías Lejía 1 L para ~60 días. Te sugerimos ~7 unid.',
    )
  })

  it('RN-OP-20: Carbón con VPD 0.25 y compra de 5 → ~60 días, no hacía falta comprar', () => {
    const situacion = {
      stock: kilos('10'),
      prediccion: conVpd(kilos('7'), 28),
      enListaParaComprar: false,
      cantidadSugerida: null,
      parado: null,
    }
    expect(mensajeDeSobrecompra(CARBON, situacion, kilos('5'), 30)).toBe(
      'Con esto tendrías Carbón para ~60 días. Ahora no necesitabas comprar.',
    )
  })

  it('RN-OP-20: una compra razonable (15 días) no avisa', () => {
    expect(mensajeDeSobrecompra(LEJIA, lejiaConVpd2, Cantidad.deEntero(20), 30)).toBeNull()
  })

  it('RN-OP-20: los días se redondean hacia abajo y solo avisa si SUPERAN el límite', () => {
    // (10 + 50) × 28 / 56 = 30 → no supera 30
    expect(mensajeDeSobrecompra(LEJIA, lejiaConVpd2, Cantidad.deEntero(50), 30)).toBeNull()
    // (10 + 53) × 28 / 56 = 31.5 → 31
    expect(mensajeDeSobrecompra(LEJIA, lejiaConVpd2, Cantidad.deEntero(53), 30)).toBe(
      'Con esto tendrías Lejía 1 L para ~31 días. Te sugerimos ~7 unid.',
    )
  })

  it('RN-OP-20: usa el límite configurado', () => {
    expect(mensajeDeSobrecompra(LEJIA, lejiaConVpd2, Cantidad.deEntero(110), 60)).toBeNull()
    expect(mensajeDeSobrecompra(LEJIA, lejiaConVpd2, Cantidad.deEntero(110), 59)).not.toBeNull()
  })

  it('RN-OP-20: en Para comprar pero sin cantidad sugerida, dice que no hacía falta', () => {
    const situacion = { ...lejiaConVpd2, cantidadSugerida: null }
    expect(mensajeDeSobrecompra(LEJIA, situacion, Cantidad.deEntero(110), 30)).toBe(
      'Con esto tendrías Lejía 1 L para ~60 días. Ahora no necesitabas comprar.',
    )
  })

  it('RN-OP-20: un producto parado avisa con su stock, antes que la predicción', () => {
    const situacion = {
      ...lejiaConVpd2,
      stock: Cantidad.deEntero(4),
      parado: { diasSinVender: 45 },
    }
    expect(
      mensajeDeSobrecompra(
        { nombre: 'Escoba', unidad: 'UNIDAD' },
        situacion,
        Cantidad.deEntero(2),
        30,
      ),
    ).toBe('Escoba no se vende hace 45 días y aún tienes 4 unid.')
  })

  it('RN-OP-20: sin predicción ni producto parado, no hay aviso', () => {
    const situacion = { ...lejiaConVpd2, prediccion: null }
    expect(mensajeDeSobrecompra(LEJIA, situacion, Cantidad.deEntero(500), 30)).toBeNull()
    const sinVentas = { ...lejiaConVpd2, prediccion: conVpd(Cantidad.cero(), 28) }
    expect(mensajeDeSobrecompra(LEJIA, sinVentas, Cantidad.deEntero(500), 30)).toBeNull()
  })
})

describe('mensajeDeRevisionDeDatos', () => {
  it('RN-OP-19: sin diferencias', () => {
    expect(mensajeDeRevisionDeDatos([])).toBe('Todo está en orden')
  })

  it('RN-OP-19: un producto corregido', () => {
    expect(
      mensajeDeRevisionDeDatos([
        { nombre: 'Carbón', unidad: 'KILO', antes: kilos('7'), despues: kilos('10') },
      ]),
    ).toBe('Corregimos el stock de 1 producto: Carbón (7 kg → 10 kg)')
  })

  it('RN-OP-19: varios productos corregidos', () => {
    expect(
      mensajeDeRevisionDeDatos([
        { nombre: 'Carbón', unidad: 'KILO', antes: kilos('7'), despues: kilos('10') },
        {
          nombre: 'Lejía 1 L',
          unidad: 'UNIDAD',
          antes: Cantidad.deEntero(3),
          despues: Cantidad.deEntero(10),
        },
      ]),
    ).toBe(
      'Corregimos el stock de 2 productos: Carbón (7 kg → 10 kg), Lejía 1 L (3 unid. → 10 unid.)',
    )
  })
})

describe('mensajes del conteo guiado', () => {
  it('RN-OP-21: progreso', () => {
    expect(progresoDelConteo(1, 3)).toBe('Llevas 1 de 3')
  })

  it('RN-OP-21: resumen con diferencia y productos saltados', () => {
    expect(
      resumenDelConteo({
        contados: 2,
        conDiferencia: 1,
        valorDeDiferencias: soles('-4.80'),
        faltantes: ['Detergente a granel'],
      }),
    ).toEqual([
      'Contaste 2 productos. 1 con diferencia: -S/ 4.80',
      'Te faltó contar 1: Detergente a granel',
    ])
  })

  it('RN-OP-21: resumen sin diferencias, en singular y sin saltados', () => {
    expect(
      resumenDelConteo({
        contados: 1,
        conDiferencia: 0,
        valorDeDiferencias: Dinero.cero(),
        faltantes: [],
      }),
    ).toEqual(['Contaste 1 producto. Todo cuadraba.'])
  })

  it('RN-OP-21: resumen con varios saltados', () => {
    expect(
      resumenDelConteo({
        contados: 2,
        conDiferencia: 2,
        valorDeDiferencias: soles('3.10'),
        faltantes: ['Carbón', 'Lejía 1 L'],
      }),
    ).toEqual([
      'Contaste 2 productos. 2 con diferencia: S/ 3.10',
      'Te faltó contar 2: Carbón, Lejía 1 L',
    ])
  })
})
