
import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  AjusteInventario,
  Cliente,
  ConsultaRucResponse,
  CrearVentaRequest,
  FiltrosHistorial,
  HistorialVentas,
  Producto,
  ResultadoImportacion,
  TipoAfectacionIgv,
  Venta
} from '../models';

import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {

  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl.replace(/\/+$/, '');

  // Rutas del API Gateway
  private readonly productosBase = `${this.base}/api/productos`;
  private readonly ventasBase = `${this.base}/api/ventas`;

  // Clientes y autenticación: pendientes de verificar en Gateway
  private readonly clientesBase = `${this.base}/clientes`;
  private readonly authBase = `${this.base}/auth`;

  // Facturación electrónica SUNAT
  private readonly facturacionBase = `${this.base}/api/facturacion`;

  // ==========================
  // PRODUCTOS
  // ==========================

  productos(consulta = ''): Observable<Producto[]> {
    return this.http.get<Producto[]>(this.productosBase, {
      params: consulta ? { q: consulta } : {}
    });
  }

  crearProducto(producto: Producto): Observable<Producto> {
    return this.http.post<Producto>(
      this.productosBase,
      producto
    );
  }

  actualizarProducto(producto: Producto): Observable<Producto> {
    return this.http.put<Producto>(
      `${this.productosBase}/${producto.id}`,
      producto
    );
  }

  actualizarAfectacionIgv(
    id: number,
    afectacionIgv: TipoAfectacionIgv
  ): Observable<Producto> {
    return this.http.patch<Producto>(
      `${this.productosBase}/${id}/afectacion-igv`,
      { afectacionIgv }
    );
  }

  eliminarProducto(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.productosBase}/${id}`
    );
  }

  ajustarStock(
    id: number,
    tipo: AjusteInventario['tipo'],
    cantidad: number,
    motivo: string
  ): Observable<Producto> {
    return this.http.post<Producto>(
      `${this.productosBase}/${id}/ajustes`,
      { tipo, cantidad, motivo }
    );
  }

  historialAjustes(id: number): Observable<AjusteInventario[]> {
    return this.http.get<AjusteInventario[]>(
      `${this.productosBase}/${id}/ajustes`
    );
  }

  importarProductos(archivo: File): Observable<ResultadoImportacion> {
    const datos = new FormData();
    datos.append('archivo', archivo);

    return this.http.post<ResultadoImportacion>(
      `${this.productosBase}/importar`,
      datos
    );
  }

  productosStockBajo(): Observable<Producto[]> {
    return this.http.get<Producto[]>(
      `${this.productosBase}/stock-bajo`
    );
  }

  // ==========================
  // CLIENTES
  // ==========================

  clientes(): Observable<Cliente[]> {
    return this.http.get<Cliente[]>(this.clientesBase);
  }

  crearCliente(cliente: Cliente): Observable<Cliente> {
    return this.http.post<Cliente>(
      this.clientesBase,
      cliente
    );
  }

  actualizarCliente(cliente: Cliente): Observable<Cliente> {
    return this.http.put<Cliente>(
      `${this.clientesBase}/${cliente.id}`,
      cliente
    );
  }

  eliminarCliente(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.clientesBase}/${id}`
    );
  }

  // ==========================
  // VENTAS
  // ==========================

  ventas(): Observable<Venta[]> {
    return this.http.get<Venta[]>(this.ventasBase);
  }

  historialVentas(filtros: FiltrosHistorial): Observable<HistorialVentas> {
    let params = new HttpParams()
      .set('pagina', filtros.pagina)
      .set('tamano', filtros.tamano);

    if (filtros.desde) {
      params = params.set('desde', filtros.desde);
    }

    if (filtros.hasta) {
      params = params.set('hasta', filtros.hasta);
    }

    if (filtros.numero?.trim()) {
      params = params.set('numero', filtros.numero.trim());
    }

    return this.http.get<HistorialVentas>(
      `${this.ventasBase}/historial`,
      { params }
    );
  }

  obtenerVenta(id: number): Observable<Venta> {
    return this.http.get<Venta>(
      `${this.ventasBase}/${id}`
    );
  }

  

crearVenta(
    venta: CrearVentaRequest,
    claveIdempotencia: string
  ): Observable<Venta> {
    return this.http.post<Venta>(
      this.ventasBase,
      {
        ...venta,
        idempotencyKey: claveIdempotencia
      },
      {
        headers: {
          'Idempotency-Key': claveIdempotencia
        }
      }
    );
  }



  anularVenta(id: number): Observable<Venta> {
    return this.http.put<Venta>(
      `${this.ventasBase}/${id}/anular`,
      {}
    );
  }

  eliminarVenta(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.ventasBase}/${id}`
    );
  }

  // ==========================
  // CONSULTAS DNI Y RUC
  // ==========================

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
    }>(
      `/external/dni?numero=${encodeURIComponent(dni)}`
    );
  }

  buscarRuc(ruc: string): Observable<ConsultaRucResponse> {
    return this.http.get<ConsultaRucResponse>(
      `${this.facturacionBase}/ruc/${encodeURIComponent(ruc)}`
    );
  }

  // ==========================
  // AUTENTICACIÓN
  // ==========================

  sesion() {
    return this.http.get<{
      username: string;
      rol: string;
    }>(`${this.authBase}/me`);
  }

  usuarios() {
    return this.http.get<Array<{
      id: number;
      username: string;
      email: string;
      rol: string;
    }>>(`${this.authBase}/usuarios`);
  }

  crearUsuario(usuario: {
    username: string;
    email: string;
    password: string;
    rol: string;
  }) {
    return this.http.post(
      `${this.authBase}/usuarios`,
      usuario
    );
  }

  cambiarPassword(
    currentPassword: string,
    newPassword: string
  ) {
    return this.http.post(
      `${this.authBase}/password`,
      { currentPassword, newPassword }
    );
  }

  login(username: string, password: string) {
    return this.http.post<{
      token: string;
      username: string;
      rol: string;
    }>(
      `${this.authBase}/login`,
      { username, password }
    );
  }
}
