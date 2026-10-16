import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { probarRepositoriosDeAnalisis } from '../__pruebas__/contrato-de-repositorios'
import {
  RepositorioDeListaDeComprasEnMemoria,
  RepositorioDeResumenesEnMemoria,
} from './repositorios'

probarRepositoriosDeAnalisis('EnMemoria', {
  resumenes: () => new RepositorioDeResumenesEnMemoria(new AlmacenEnMemoria()),
  listaDeCompras: () => new RepositorioDeListaDeComprasEnMemoria(new AlmacenEnMemoria()),
})
