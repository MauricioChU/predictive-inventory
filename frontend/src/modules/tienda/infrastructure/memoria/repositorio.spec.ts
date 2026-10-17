import { describe } from 'vitest'
import { AlmacenEnMemoria } from '../../../../shared/infrastructure/memoria/almacen-en-memoria'
import { probarRepositorioDeConfiguracion } from '../__pruebas__/contrato-de-repositorio'
import { RepositorioDeConfiguracionEnMemoria } from './repositorio'

describe('RepositorioDeConfiguracionEnMemoria', () => {
  probarRepositorioDeConfiguracion(
    () => new RepositorioDeConfiguracionEnMemoria(new AlmacenEnMemoria()),
  )
})
