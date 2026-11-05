import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Cliente, CrearVentaRequest, Producto, Venta, DocumentoConsulta } from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  productos(): Observable<Producto[]> {
    return this.http.get<Producto[]>(`${this.base}/productos`);
  }

  crearProducto(producto: Producto): Observable<Producto> {
    return this.http.post<Producto>(`${this.base}/productos`, producto);
  }

  actualizarProducto(producto: Producto): Observable<Producto> {
    return this.http.put<Producto>(`${this.base}/productos/${producto.id}`, producto);
  }

  eliminarProducto(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/productos/${id}`);
  }

  ajustarStock(id: number, tipo: 'reponer' | 'descontar', cantidad: number): Observable<Producto> {
    return this.http.post<Producto>(`${this.base}/productos/${id}/stock/${tipo}`, { cantidad });
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

  buscarDni(dni: string): Observable<DocumentoConsulta> { return this.http.get<DocumentoConsulta>(this.base + '/clientes/documentos/dni/' + dni); }
  buscarRuc(ruc: string): Observable<DocumentoConsulta> { return this.http.get<DocumentoConsulta>(this.base + '/clientes/documentos/ruc/' + ruc); }
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
