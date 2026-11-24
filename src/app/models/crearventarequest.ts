import type { DetalleVenta } from './detalleventa';
import type { TipoComprobante } from './tipocomprobante';

export interface CrearVentaRequest {
  metodoPago?: string;
  clienteId?: number;
  tipoComprobante: TipoComprobante;
  documento?: string;
  compradorNombre?: string;
  detalles: Array<Pick<DetalleVenta, 'productoId' | 'cantidad'>>;
  idempotencyKey: string;
  tipoDocumento?: 'DNI' | 'RUC';
numeroDocumento?: string;
clienteNombre?: string;
}