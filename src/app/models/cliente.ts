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
