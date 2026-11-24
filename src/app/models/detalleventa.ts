export interface DetalleVenta {
  id?: number;
  productoId: number;
  productoNombre?: string;
  cantidad: number;
  precioUnitario?: number;
  subtotal?: number;
}
