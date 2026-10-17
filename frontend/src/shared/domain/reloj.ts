import { sumarSegundos, type Instante } from './fecha'

export interface Reloj {
  ahora(): Instante
}

export class RelojDelSistema implements Reloj {
  ahora(): Instante {
    return new Date().toISOString()
  }
}

export class RelojFijo implements Reloj {
  constructor(private actual: Instante) {}
  ahora(): Instante {
    return this.actual
  }
  fijar(instante: Instante): void {
    this.actual = instante
  }
  avanzarSegundos(segundos: number): void {
    this.actual = sumarSegundos(this.actual, segundos)
  }
}
