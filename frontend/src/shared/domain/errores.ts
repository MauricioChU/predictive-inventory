/** Violación de una regla de negocio. `mensaje` es el texto exacto que ve el usuario (spec). */
export class ErrorDeDominio extends Error {
  constructor(
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje)
    this.name = 'ErrorDeDominio'
  }
}

export function esErrorDeDominio(error: unknown): error is ErrorDeDominio {
  return error instanceof ErrorDeDominio
}
