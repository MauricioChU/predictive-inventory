import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { probarRepositoriosDeCatalogo } from '../__pruebas__/contrato-de-repositorios'
import {
  RepositorioDeCategoriasEnMemoria,
  RepositorioDeFotosEnMemoria,
  RepositorioDeProductosEnMemoria,
} from './repositorios'

probarRepositoriosDeCatalogo('EnMemoria', {
  productos: () => new RepositorioDeProductosEnMemoria(new AlmacenEnMemoria()),
  categorias: () => new RepositorioDeCategoriasEnMemoria(new AlmacenEnMemoria()),
  fotos: () => new RepositorioDeFotosEnMemoria(new AlmacenEnMemoria()),
})
