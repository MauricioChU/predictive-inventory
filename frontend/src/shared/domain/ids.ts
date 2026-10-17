export interface GeneradorDeIds {
  nuevo(): string
}

export class IdsAleatorios implements GeneradorDeIds {
  nuevo(): string {
    return crypto.randomUUID()
  }
}

export class IdsSecuenciales implements GeneradorDeIds {
  private contador = 0
  constructor(private readonly prefijo = 'id') {}
  nuevo(): string {
    this.contador += 1
    return `${this.prefijo}-${this.contador}`
  }
}
