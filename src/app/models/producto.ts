import type { TipoAfectacionIgv } from './tipoafectacionigv';
import type { EstadoStock } from './estadostock';
export interface Producto {
  id?: number;
  readonly codigo?: string;
  nombre: string;
  descripcion?: string | null;
  precio: number;
  stock: number;
  stockMinimo?: number;
  readonly estadoStock?: EstadoStock;
  activo?: boolean;
  version?: number;
  afectacionIgv?: TipoAfectacionIgv | null;
}
