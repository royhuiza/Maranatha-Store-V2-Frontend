import type { DetalleVenta } from './detalleventa';
import type { TipoComprobante } from './tipocomprobante';
export interface Venta {
  id: number;
  clienteId?: number;
  clienteNombre: string;
  clienteDocumento?: string;
  compradorLocalNombre?: string;
  compradorLocalDocumento?: string;
  fecha: string;
  total: number;
  detalles: DetalleVenta[];
  tipoComprobante: TipoComprobante;
  serie: string;
  numero: string;
  estado: 'EMITIDA' | 'ANULADA';
}
