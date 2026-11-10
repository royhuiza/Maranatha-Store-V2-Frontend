export interface Producto {
  id?: number;
  nombre: string;
  descripcion?: string | null;
  precio: number;
  stock: number;
  /** T40: umbral propio del artículo (por defecto 5). */
  stockMinimo?: number;
  /** T41: calculado por el backend comparando stock y stockMinimo. */
  readonly estadoStock?: EstadoStock;
  activo?: boolean;
  version?: number;
}

export type EstadoStock = 'DISPONIBLE' | 'STOCK_BAJO' | 'SIN_STOCK';

/** T67/T69: página del historial de ventas devuelta por el backend. */
export interface HistorialVentas {
  contenido: Venta[];
  pagina: number;
  tamano: number;
  totalElementos: number;
  totalPaginas: number;
  totalMonto: number;
  totalVentas: number;
}

export interface FiltrosHistorial {
  desde?: string;
  hasta?: string;
  numero?: string;
  pagina: number;
  tamano: number;
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
  /** DNI/RUC escrito a mano cuando no hay cliente registrado; solo se guarda en la venta. */
  documento?: string;
  detalles: Array<Pick<DetalleVenta, 'productoId' | 'cantidad'>>;
}

export interface Venta {
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
