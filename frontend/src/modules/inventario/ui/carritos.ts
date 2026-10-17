import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import { usarCarrito } from './carrito-de-pantalla'

/**
 * r1 M9 (principio 2 de 06: nada se pierde por un toque equivocado): los carritos de Vender y
 * de Llegó mercadería (con su "¿Cuándo fue?") viven aquí, en memoria, y no dentro de la
 * pantalla: un toque en la barra de navegación ya no los borra. Se vacían al registrar.
 *
 * markRaw: cada carrito ya es reactivo por dentro (refs y computed); sin él, el store los
 * envolvería y desarmaría sus refs (`carrito.total.value` dejaría de existir).
 */
export const useCarritos = defineStore('operaciones-carritos', () => ({
  venta: markRaw(usarCarrito('venta')),
  ingreso: markRaw(usarCarrito('ingreso')),
}))
