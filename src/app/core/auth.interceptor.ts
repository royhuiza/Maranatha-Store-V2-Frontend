
import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpInterceptorFn
} from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError, of } from 'rxjs';
import { HttpResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/password/forgot',
  '/auth/password/reset'
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const base = environment.apiUrl.replace(/\/+$/, '');
  const path = extractPath(req.url);

  const isGateway =
    req.url === base ||
    req.url.startsWith(base + '/') ||
    req.url.startsWith('/api/');

  let request = req;

  // =====================================================
  // AISLAMIENTO DEL LABORATORIO BETA
  // =====================================================

  if (environment.demoFiscal) {
    const metodo = req.method.toUpperCase();
    const ruta = path.replace(/^\/api\//, '/');

    if (ruta === '/ventas/yape/eventos' && metodo === 'GET') {
      return of(new HttpResponse({
        status: 200,
        body: []
      }));
    }

    let destino: string | null = null;

    if (metodo === 'GET') {
      if (ruta === '/productos') {
        destino = '/ventas/demo/catalogo';
      } else if (ruta === '/productos/stock-bajo') {
        destino = '/ventas/demo/catalogo/bajo';
      } else if (/^\/productos\/\d+$/.test(ruta)) {
        destino = ruta.replace(
          '/productos/',
          '/ventas/demo/catalogo/'
        );
      } else if (ruta === '/clientes') {
        destino = '/ventas/demo/clientes';
      } else if (/^\/clientes\/documentos\/dni\/\d{8}$/.test(ruta)) {
        destino = ruta.replace(
          '/clientes/documentos/dni/',
          '/ventas/demo/dni/'
        );
      } else if (
        /^\/facturacion\/ruc\/\d{11}$/.test(ruta) ||
        /^\/clientes\/documentos\/ruc\/\d{11}$/.test(ruta)
      ) {
        destino = '/ventas/demo/ruc/' + ruta.split('/').pop();
      }
    }

    if (destino && isGateway) {
      const query = req.url.includes('?')
        ? '?' + req.url.split('?').slice(1).join('?')
        : '';

      request = req.clone({
        url: base + destino + query
      });
    } else {
      const autenticacion =
        (metodo === 'POST' && ruta === '/auth/login') ||
        (metodo === 'GET' && ruta === '/auth/me');

      const lecturaVentas =
        metodo === 'GET' && (
          ruta === '/ventas' ||
          ruta === '/ventas/historial' ||
          /^\/ventas\/\d+(\/estado-sunat|\/comprobante-local)?$/.test(ruta)
        );

      const lecturaDemo =
        metodo === 'GET' &&
        /^\/ventas\/demo\/(catalogo(\/bajo|\/\d+)?|clientes|dni\/\d{8}|ruc\/\d{11})$/.test(ruta);

      const registrarVenta =
        metodo === 'POST' && ruta === '/ventas';

      const anularVenta =
        metodo === 'PUT' &&
        /^\/ventas\/\d+\/anular$/.test(ruta);

      const evidenciaBeta =
        metodo === 'GET' &&
        /^\/facturacion\/laboratorio\/comprobantes\/(?:[BF]9B1\/)?\d{8}$/.test(ruta);

      if (
        !isGateway ||
        !(
          autenticacion ||
          lecturaVentas ||
          lecturaDemo ||
          registrarVenta ||
          anularVenta ||
          evidenciaBeta
        )
      ) {
        return throwError(() => new HttpErrorResponse({
          status: 403,
          statusText: 'Operacion bloqueada en laboratorio Beta',
          url: req.url,
          error: {
            message: 'Esta operacion no esta disponible en modo de prueba.'
          }
        }));
      }

      if (registrarVenta) {
        const body = req.body as {
          metodoPago?: string;
          tipoComprobante?: string;
          numeroDocumento?: string;
          documento?: string;
        } | null;

        const documento =
          body?.numeroDocumento || body?.documento || '';

        const documentoValido =
          (body?.tipoComprobante === 'BOLETA' &&
            documento === '00000000') ||
          (body?.tipoComprobante === 'FACTURA' &&
            documento === '20123456786') ||
          (body?.tipoComprobante === 'NOTA_PEDIDO' &&
            !documento);

        if (
          !body ||
          body.metodoPago !== 'EFECTIVO' ||
          !documentoValido
        ) {
          return throwError(() => new HttpErrorResponse({
            status: 400,
            error: {
              message: 'Utiliza efectivo simulado y documentos sinteticos del laboratorio.'
            }
          }));
        }
      }
    }
  }

  // =====================================================
  // AUTENTICACION ORIGINAL
  // =====================================================

  const finalPath = extractPath(request.url);

  const isPublic = PUBLIC_PATHS.some(
    publica => finalPath.endsWith(publica)
  );

  const isRucConsulta =
    finalPath.includes('/facturacion/ruc/');

  const token = localStorage.getItem('token');

  const securedRequest =
    isGateway && !isPublic && token
      ? request.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        })
      : request;

  return next(securedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (
        error.status === 401 &&
        isGateway &&
        !isPublic &&
        !isRucConsulta
      ) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('rol');

        void router.navigateByUrl('/login');
      }

      return throwError(() => error);
    })
  );
};

function extractPath(url: string): string {
  return url.startsWith('http')
    ? new URL(url).pathname
    : url.split('?')[0];
}
