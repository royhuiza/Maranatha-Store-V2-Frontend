import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

/** Rutas del Gateway que se pueden invocar sin token. */
const PUBLIC_PATHS = ['/auth/login', '/auth/password/forgot', '/auth/password/reset'];

/**
 * Interceptor de autenticacion.
 *
 * Como la app llama directo al API Gateway (http://localhost:8080), el token se
 * adjunta a toda peticion dirigida al Gateway, salvo las rutas publicas.
 * La consulta RUC de SUNAT tambien se exime del cierre de sesion: un 401 ahi
 * significa que el servicio de facturacion no autorizo la consulta, no que la
 * sesion haya caducado.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const path = extractPath(req.url);
  const isGateway = req.url.startsWith(environment.apiUrl) || path.startsWith('/api/');
  const isPublic = PUBLIC_PATHS.some(publica => path.endsWith(publica));
  const isRucConsulta = path.includes('/facturacion/ruc/');
  const token = localStorage.getItem('token');
  const securedRequest = isGateway && !isPublic && token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(securedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      // Public recovery requests display their errors in place, without navigating.
      if (error.status === 401 && isGateway && !isPublic && !isRucConsulta) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('rol');
        void router.navigateByUrl('/login');
      }
      return throwError(() => error);
    })
  );
};

/** Extrae la ruta de una URL absoluta o relativa. */
function extractPath(url: string): string {
  return url.startsWith('http') ? new URL(url).pathname : url.split('?')[0];
}
