/**
 * Conversión Blob ↔ base64 para las fotos del respaldo (RN-RE-02: "fotos en base64").
 * Usa `blob.arrayBuffer()` + `btoa`/`atob`, que funcionan tanto en el navegador real como
 * en jsdom (a diferencia de FileReader con eventos, que no hacía falta aquí).
 */

export async function blobABase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binario = ''
  for (const byte of bytes) binario += String.fromCharCode(byte)
  return btoa(binario)
}

export async function base64ABlob(base64: string, tipo: string): Promise<Blob> {
  const binario = atob(base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
  return new Blob([bytes], { type: tipo })
}
