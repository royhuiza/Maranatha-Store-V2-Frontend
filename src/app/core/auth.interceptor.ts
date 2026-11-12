import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const path = req.url.split('?')[0];
  const isApi = path.startsWith('/api/');
  const isPublic = ['/api/auth/login', '/api/auth/password/forgot', '/api/auth/password/reset'].includes(path);
  const token = localStorage.getItem('token');
  const securedRequest = isApi && !isPublic && token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(securedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      // Public recovery requests and the SUNAT RUC lookup display their errors in place,
      // without forcing a logout/navigation.
      if (error.status === 401 && isApi && !isPublic && !req.url.includes('/facturacion/ruc/')) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('rol');
        void router.navigateByUrl('/login');
      }
      return throwError(() => error);
    })
  );
};