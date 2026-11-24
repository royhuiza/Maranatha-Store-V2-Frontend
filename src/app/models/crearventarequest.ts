import type { DetalleVenta } from './detalleventa';
import type { TipoComprobante } from './tipocomprobante';
export interface CrearVentaRequest {
  metodoPago?: string;
  clienteId?: number;
  tipoComprobante: TipoComprobante;
  /** DNI/RUC escrito a mano cuando no hay cliente registrado; solo se guarda en la venta. */
  documento?: string;
  compradorNombre?: string;
  detalles: Array<Pick<DetalleVenta, 'productoId' | 'cantidad'>>;
}
