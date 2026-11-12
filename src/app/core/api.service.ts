import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AjusteInventario, Cliente, ConsultaRucResponse, CrearVentaRequest, Producto, ResultadoImportacion, TipoAfectacionIgv, Venta } from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  productos(consulta = ''): Observable<Producto[]> {
    return this.http.get<Producto[]>(`${this.base}/productos`, {
      params: consulta ? { q: consulta } : {}
    });
  }

  crearProducto(producto: Producto): Observable<Producto> {
    return this.http.post<Producto>(`${this.base}/productos`, producto);
  }

  actualizarProducto(producto: Producto): Observable<Producto> {
    return this.http.put<Producto>(`${this.base}/productos/${producto.id}`, producto);
  }


  actualizarAfectacionIgv(
    id: number,
    afectacionIgv: TipoAfectacionIgv
  ): Observable<Producto> {
    return this.http.patch<Producto>(
      `${this.base}/productos/${id}/afectacion-igv`,
      { afectacionIgv }
    );
  }



  eliminarProducto(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/productos/${id}`);
  }

  ajustarStock(id: number, tipo: AjusteInventario['tipo'], cantidad: number, motivo: string): Observable<Producto> {
    return this.http.post<Producto>(`${this.base}/productos/${id}/ajustes`, { tipo, cantidad, motivo });
  }

  historialAjustes(id: number): Observable<AjusteInventario[]> {
    return this.http.get<AjusteInventario[]>(`${this.base}/productos/${id}/ajustes`);
  }

  importarProductos(archivo: File): Observable<ResultadoImportacion> {
    const datos = new FormData();
    datos.append('archivo', archivo);
    return this.http.post<ResultadoImportacion>(`${this.base}/productos/importar`, datos);
  }

  clientes(): Observable<Cliente[]> {
    return this.http.get<Cliente[]>(`${this.base}/clientes`);
  }

  crearCliente(cliente: Cliente): Observable<Cliente> {
    return this.http.post<Cliente>(`${this.base}/clientes`, cliente);
  }

  actualizarCliente(cliente: Cliente): Observable<Cliente> {
    return this.http.put<Cliente>(`${this.base}/clientes/${cliente.id}`, cliente);
  }

  eliminarCliente(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/clientes/${id}`);
  }

  ventas(): Observable<Venta[]> {
    return this.http.get<Venta[]>(`${this.base}/ventas`);
  }

  obtenerVenta(id: number): Observable<Venta> {
    return this.http.get<Venta>(`${this.base}/ventas/${id}`);
  }

  crearVenta(venta: CrearVentaRequest): Observable<Venta> {
    return this.http.post<Venta>(`${this.base}/ventas`, venta);
  }

  anularVenta(id: number): Observable<Venta> {
    return this.http.put<Venta>(`${this.base}/ventas/${id}/anular`, {});
  }

  eliminarVenta(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/ventas/${id}`);
  }

  buscarDni(dni: string): Observable<{
    numeroDocumento: string;
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    estado?: string;
  }> {
    return this.http.get<{
      numeroDocumento: string;
      nombres: string;
      apellidoPaterno: string;
      apellidoMaterno: string;
      estado?: string;
    }>(`/external/dni?numero=${encodeURIComponent(dni)}`);
  }

  buscarRuc(ruc: string): Observable<ConsultaRucResponse> {
    return this.http.get<ConsultaRucResponse>(
      `${this.base}/facturacion/ruc/${encodeURIComponent(ruc)}`
    );
  }

  sesion() { return this.http.get<{ username: string; rol: string }>(this.base + '/auth/me'); }

  usuarios() { return this.http.get<Array<{id: number; username: string; email: string; rol: string}>>(this.base + '/auth/usuarios'); }
  crearUsuario(usuario: {username: string; email: string; password: string; rol: string}) { return this.http.post(this.base + '/auth/usuarios', usuario); }
  cambiarPassword(currentPassword: string, newPassword: string) { return this.http.post(this.base + '/auth/password', { currentPassword, newPassword }); }

  login(username: string, password: string) {
    return this.http.post<{ token: string; username: string; rol: string }>(
      `${this.base}/auth/login`,
      { username, password }
    );
  }
}
