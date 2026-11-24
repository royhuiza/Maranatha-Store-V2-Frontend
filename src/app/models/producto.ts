import type { TipoAfectacionIgv } from './tipoafectacionigv';
import type { EstadoStock } from './estadostock';
export interface Producto {
  id?: number;
  readonly codigo?: string;
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
  afectacionIgv?: TipoAfectacionIgv | null;
}
