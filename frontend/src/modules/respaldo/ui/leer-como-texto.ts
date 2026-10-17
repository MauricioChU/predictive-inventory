/** El texto de un archivo elegido por la persona (la copia `.json`), con FileReader. */
export function leerComoTexto(archivo: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => resolver(String(lector.result))
    lector.onerror = () => rechazar(lector.error ?? new Error('No se pudo leer el archivo'))
    lector.readAsText(archivo)
  })
}
