/**
 * Con la transición `out-in` la vista que se va sigue en su sitio mientras se desvanece. Si el
 * router llevara la página arriba de inmediato, se la vería saltar: el router espera aquí a que
 * termine de irse (LayoutApp avisa). Sin vista saliendo (primera carga, misma vista) no espera.
 */
let saliendo = false
let esperando: Array<() => void> = []

export function avisarSalidaDeVista(): void {
  saliendo = true
}

export function avisarVistaSalio(): void {
  saliendo = false
  const pendientes = esperando
  esperando = []
  pendientes.forEach((seguir) => seguir())
}

export function esperarSalidaDeVista(): Promise<void> {
  if (!saliendo) return Promise.resolve()
  return new Promise((resolver) => {
    esperando.push(resolver)
    // Respaldo: nunca se queda sin llevar la página arriba.
    setTimeout(avisarVistaSalio, 600)
  })
}
