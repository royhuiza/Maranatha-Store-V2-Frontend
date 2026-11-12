import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private sessionRole?: string;
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  login(username: string, password: string) {
    return this.api.login(username, password).pipe(
      tap(response => {
        localStorage.setItem('token', response.token);
        const rawUsername = response.username;
        const normalizedUsername = typeof rawUsername === 'string' && rawUsername.trim()
          ? rawUsername.trim()
          : '';
        localStorage.setItem('username', normalizedUsername);
        this.sessionRole = this.normalizarRol(response.rol);
        localStorage.setItem('rol', this.sessionRole);
      })
    );
  }

  logout(): void {
    this.sessionRole = undefined;
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('rol');
    this.router.navigateByUrl('/login');
  }

  isLogged(): boolean {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (!payload.exp || payload.exp * 1000 <= Date.now()) {
        this.logout();
        return false;
      }
      return true;
    } catch {
      this.logout();
      return false;
    }
  }

  get isAdmin(): boolean {
    if (!this.isLogged()) return false;
    try { const token = localStorage.getItem('token') || ''; const data = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return this.normalizarRol(this.sessionRole || data.role || localStorage.getItem('rol')) === 'ADMIN'; }
    catch { return false; }
  }
  private normalizarRol(rol: unknown): string { return typeof rol === 'string' ? rol.trim().toUpperCase().replace(/^ROLE_/, '') : ''; }
  refrescarSesion(): void { this.api.sesion().subscribe({ next: sesion => { this.sessionRole = this.normalizarRol(sesion.rol); localStorage.setItem('rol', this.sessionRole); localStorage.setItem('username', sesion.username); }, error: () => { /* Existing JWT remains subject to backend validation. */ } }); }
  get username(): string {
    const username = localStorage.getItem('username') || '';
    if (!username || /com\.libreria\.auth\.model\.Usuario|\$\$Lambda/.test(username)) {
      return 'USUARIO';
    }
    return username.toUpperCase();
  }
}
