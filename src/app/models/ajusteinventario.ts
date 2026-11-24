export interface AjusteInventario {
  id: number;
  tipo: 'REPONER' | 'DESCONTAR';
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
  motivo: string;
  fecha: string;
}
