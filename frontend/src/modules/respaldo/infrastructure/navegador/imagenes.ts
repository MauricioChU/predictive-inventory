/**
 * Conversión Blob ↔ base64 para las fotos del respaldo (RN-RE-02: "fotos en base64").
 * Usa `blob.arrayBuffer()` + `btoa`/`atob`, que funcionan tanto en el navegador real como
 * en jsdom (a diferencia de FileReader con eventos, que no hacía falta aquí).
 */

/** Se convierte en trozos para no desbordar la pila con fotos grandes. */
const TROZO = 0x8000

export async function blobABase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const trozos: string[] = []
  for (let i = 0; i < bytes.length; i += TROZO) {
    trozos.push(
      String.fromCharCode.apply(null, bytes.subarray(i, i + TROZO) as unknown as number[]),
    )
  }
  return btoa(trozos.join(''))
}

export async function base64ABlob(base64: string, tipo: string): Promise<Blob> {
  const binario = atob(base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
  return new Blob([bytes], { type: tipo })
}
