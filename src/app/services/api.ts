import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  AjusteInventario,
  Cliente,
  ConsultaRucResponse,
  CrearVentaRequest,
  DocumentoConsulta,
  FiltrosHistorial,
  HistorialVentas,
  Producto,
  ResultadoImportacion,
  TipoAfectacionIgv,
  Venta
} from '../models';

import { environment } from '../../environments/environment';

import type {
  EstadoWeb,
  LocalWeb,
  BetaWeb
} from '../core/facturacion-web';

/**
 * Cliente HTTP del API Gateway.
 *
 * La URL base se obtiene de environment.apiUrl.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {

  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl.replace(/\/+$/, '');

  // =====================================================
  // YAPE
  // =====================================================

  eventosYape(): Observable<Array<{
    id: string;
    monto: number;
    fecha: number;
  }>> {
    return this.http.get<Array<{
      id: string;
      monto: number;
      fecha: number;
    }>>(`${this.base}/ventas/yape/eventos`);
  }

  // =====================================================
  // PRODUCTOS E INVENTARIO
  // =====================================================

  productos(consulta = ''): Observable<Producto[]> {
    return this.http.get<Producto[]>(
      `${this.base}/api/productos`,
      {
        params: consulta ? { q: consulta } : {}
      }
    );
  }

  crearProducto(producto: Producto): Observable<Producto> {
    return this.http.post<Producto>(
      `${this.base}/api/productos`,
      producto
    );
  }

  actualizarProducto(producto: Producto): Observable<Producto> {
    return this.http.put<Producto>(
      `${this.base}/api/productos/${producto.id}`,
      producto
    );
  }

  actualizarAfectacionIgv(
    id: number,
    afectacionIgv: TipoAfectacionIgv
  ): Observable<Producto> {
    return this.http.patch<Producto>(
      `${this.base}/api/productos/${id}/afectacion-igv`,
      { afectacionIgv }
    );
  }

  eliminarProducto(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/api/productos/${id}`
    );
  }

  ajustarStock(
    id: number,
    tipo: AjusteInventario['tipo'],
    cantidad: number,
    motivo: string
  ): Observable<Producto> {
    return this.http.post<Producto>(
      `${this.base}/api/productos/${id}/ajustes`,
      { tipo, cantidad, motivo }
    );
  }

  historialAjustes(id: number): Observable<AjusteInventario[]> {
    return this.http.get<AjusteInventario[]>(
      `${this.base}/api/productos/${id}/ajustes`
    );
  }

  importarProductos(archivo: File): Observable<ResultadoImportacion> {
    const datos = new FormData();
    datos.append('archivo', archivo);

    return this.http.post<ResultadoImportacion>(
      `${this.base}/api/productos/importar`,
      datos
    );
  }

  productosStockBajo(): Observable<Producto[]> {
    return this.http.get<Producto[]>(
      `${this.base}/api/productos/stock-bajo`
    );
  }

  // =====================================================
  // CLIENTES
  // =====================================================

  clientes(): Observable<Cliente[]> {
    return this.http.get<Cliente[]>(
      `${this.base}/clientes`
    );
  }

  crearCliente(cliente: Cliente): Observable<Cliente> {
    return this.http.post<Cliente>(
      `${this.base}/clientes`,
      cliente
    );
  }

  actualizarCliente(cliente: Cliente): Observable<Cliente> {
    return this.http.put<Cliente>(
      `${this.base}/clientes/${cliente.id}`,
      cliente
    );
  }

  eliminarCliente(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/clientes/${id}`
    );
  }

  // =====================================================
  // CONSULTA DE DOCUMENTOS DNI Y RUC
  // =====================================================

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
      `${this.base}/clientes/documentos/dni/${encodeURIComponent(dni)}`
    );
  }

  buscarRuc(ruc: string): Observable<ConsultaRucResponse> {
    return this.http.get<ConsultaRucResponse>(
      `${this.base}/api/facturacion/ruc/${encodeURIComponent(ruc)}`
    );
  }

  // =====================================================
  // VENTAS
  // =====================================================

  ventas(): Observable<Venta[]> {
    return this.http.get<Venta[]>(
      `${this.base}/api/ventas`
    );
  }

  historialVentas(
    filtros: FiltrosHistorial
  ): Observable<HistorialVentas> {

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
      `${this.base}/api/ventas/historial`,
      { params }
    );
  }

  obtenerVenta(id: number): Observable<Venta> {
    return this.http.get<Venta>(
      `${this.base}/api/ventas/${id}`
    );
  }

  crearVenta(
    venta: CrearVentaRequest,
    claveIdempotencia: string
  ): Observable<Venta> {
    return this.http.post<Venta>(
      `${this.base}/api/ventas`,
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
      `${this.base}/api/ventas/${id}/anular`,
      {}
    );
  }

  eliminarVenta(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/api/ventas/${id}`
    );
  }

  // =====================================================
  // ENVÍO DE COMPROBANTES
  // =====================================================

  crearEnlaceComprobante(
    id: number,
    archivo: File
  ): Observable<{ url: string }> {

    const datos = new FormData();
    datos.append('archivo', archivo);

    return this.http.post<{ url: string }>(
      `${this.base}/api/ventas/${id}/enlace`,
      datos
    );
  }

  enviarCorreo(
    id: number,
    correo: string,
    archivo: File
  ): Observable<void> {

    const datos = new FormData();
    datos.append('correo', correo);
    datos.append('archivo', archivo);

    return this.http.post<void>(
      `${this.base}/api/ventas/${id}/correo`,
      datos
    );
  }

  // =====================================================
  // FACTURACIÓN ELECTRÓNICA - SUNAT
  // =====================================================

  /**
   * Consulta el estado fiscal registrado de una venta.
   */
  estadoFiscalWeb(id: number): Observable<EstadoWeb> {
    return this.http.get<EstadoWeb>(
      `${this.base}/api/ventas/${id}/estado-sunat`
    );
  }

  /**
   * Obtiene el comprobante local y su desglose tributario.
   */
  comprobanteLocalWeb(id: number): Observable<LocalWeb> {
    return this.http.get<LocalWeb>(
      `${this.base}/api/ventas/${id}/comprobante-local`
    );
  }

  /**
   * Consulta la referencia Beta asociada a una venta interna.
   */
  comprobanteBetaWeb(id: number) {
    return this.http.get<{
      ambiente: string;
      validezFiscal: boolean;
      ventaId: number;
      serieComercial: string;
      numeroComercial: string;
      serie: string;
      numero: string;
      tipoComprobante: string;
      fechaEmision: string;
      estadoSunat: string;
      codigo: string | null;
      estadoVenta: string;
      igv: number;
      total: number;
      aceptado: boolean;
    }>(`${this.base}/api/ventas/${id}/comprobante-beta`);
  }

  /**
   * Solicita una emisión en el laboratorio SUNAT Beta.
   * Exclusivamente para pruebas sin validez fiscal.
   */
  emitirLaboratorioWeb(operacion: string): Observable<{
    serie: string;
    numero: string;
    estadoSunat: string;
    codigo: string | null;
    ambiente: string;
    validezFiscal: boolean;
  }> {
    return this.http.post<{
      serie: string;
      numero: string;
      estadoSunat: string;
      codigo: string | null;
      ambiente: string;
      validezFiscal: boolean;
    }>(
      `${this.base}/api/ventas/laboratorio/emision-beta/${encodeURIComponent(operacion)}`,
      {}
    );
  }

  /**
   * Obtiene la evidencia archivada de un comprobante Beta
   * mediante su serie y número.
   */
  evidenciaVentaBetaWeb(
    serie: string,
    numero: string
  ): Observable<BetaWeb> {
    return this.http.get<BetaWeb>(
      `${this.base}/api/facturacion/laboratorio/comprobantes/${encodeURIComponent(serie)}/${encodeURIComponent(numero)}`
    );
  }

  /**
   * Consulta la evidencia del laboratorio por correlativo.
   */
  evidenciaBetaWeb(numero: string): Observable<BetaWeb> {
    return this.http.get<BetaWeb>(
      `${this.base}/api/facturacion/laboratorio/comprobantes/${encodeURIComponent(numero)}`
    );
  }

  // =====================================================
  // AUTENTICACIÓN
  // =====================================================

  sesion() {
    return this.http.get<{
      username: string;
      rol: string;
    }>(`${this.base}/auth/me`);
  }

  login(username: string, password: string) {
    return this.http.post<{
      token: string;
      username: string;
      rol: string;
    }>(
      `${this.base}/auth/login`,
      { username, password }
    );
  }

  // =====================================================
  // GESTIÓN DE USUARIOS
  // =====================================================

  usuarios() {
    return this.http.get<Array<{
      id: number;
      username: string;
      email: string;
      rol: string;
      activo: boolean;
    }>>(`${this.base}/auth/usuarios`);
  }

  crearUsuario(usuario: {
    username: string;
    email: string;
    password: string;
    rol: string;
  }) {
    return this.http.post(
      `${this.base}/auth/usuarios`,
      usuario
    );
  }

  actualizarUsuario(
    id: number,
    datos: {
      username: string;
      email: string;
      rol: string;
      password?: string;
    }
  ) {
    return this.http.put(
      `${this.base}/auth/usuarios/${id}`,
      datos
    );
  }

  eliminarUsuario(id: number) {
    return this.http.delete<void>(
      `${this.base}/auth/usuarios/${id}`
    );
  }

  reactivarUsuario(id: number) {
    return this.http.patch(
      `${this.base}/auth/usuarios/${id}/reactivar`,
      {}
    );
  }

  cambiarPassword(
    currentPassword: string,
    newPassword: string
  ) {
    return this.http.post(
      `${this.base}/auth/password`,
      { currentPassword, newPassword }
    );
  }
}
