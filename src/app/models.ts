export interface Producto {
  id?: number;
  nombre: string;
  descripcion?: string | null;
  precio: number;
  stock: number;
  activo?: boolean;
  version?: number;
}

export interface AjusteInventario {
  id: number;
  tipo: 'REPONER' | 'DESCONTAR';
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
  motivo: string;
  fecha: string;
}

export interface ResultadoImportacion {
  nuevos: number;
  actualizados: number;
  sinCambios: number;
}

export interface Cliente {
  id?: number;
  nombre: string;
  apellido?: string | null;
  tipoDocumento?: 'DNI' | 'RUC' | 'CE' | string;
  numeroDocumento?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  activo?: boolean;
  fechaRegistro?: string;
}

export interface DetalleVenta {
  id?: number;
  productoId: number;
  productoNombre?: string;
  cantidad: number;
  precioUnitario?: number;
  subtotal?: number;
}

export type TipoComprobante = 'BOLETA' | 'FACTURA' | 'NOTA_PEDIDO';

export interface CrearVentaRequest {
  clienteId?: number;
  tipoComprobante: TipoComprobante;
  metodoPago?: string;
  detalles: Array<Pick<DetalleVenta, 'productoId' | 'cantidad'>>;
}

export interface Venta {
  metodoPago?: string;
  validadoSunat?: boolean;
  estadoPago?: string;
  id: number;
  clienteId?: number;
  clienteNombre: string;
  clienteDocumento?: string;
  fecha: string;
  total: number;
  detalles: DetalleVenta[];
  tipoComprobante: TipoComprobante;
  serie: string;
  numero: string;
  estado: 'EMITIDA' | 'ANULADA';
}

export interface ApiError {
  status?: number;
  message?: string;
}

export interface DocumentoConsulta { tipoDocumento: 'DNI' | 'RUC'; numeroDocumento: string; nombre: string; nombres?: string; apellidoPaterno?: string; apellidoMaterno?: string; direccion?: string; estado?: string; condicion?: string; proveedor: string; }
