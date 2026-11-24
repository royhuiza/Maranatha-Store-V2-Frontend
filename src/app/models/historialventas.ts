import type { Venta } from './venta';
export interface HistorialVentas {
  contenido: Venta[];
  pagina: number;
  tamano: number;
  totalElementos: number;
  totalPaginas: number;
  totalMonto: number;
  totalVentas: number;
}
