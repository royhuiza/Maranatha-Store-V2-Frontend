import { OriginkitSceneComponent } from '../core/originkit-scene.component';
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ApiError } from '../models';

@Component({
  standalone: true,
  imports: [OriginkitSceneComponent, CommonModule, FormsModule, RouterLink],
  template: `
    <div class="login-page login-experience authkit-login" [class.login-dark]="darkMode">
      <section class="login-stage" aria-label="Bienvenida a Maranatha Store">
        <app-originkit-scene effect="meadow" />
        <div class="login-stage-pattern" aria-hidden="true"></div>
        <div class="stage-top">
          <img class="maranatha-brand-image stage-brand-image" src="/maranatha-logo.png" alt="Librería Maranatha" (error)="onLogoError($event)">
          <span class="brand-fallback">MARANATHA / STORE</span>
        </div>
        <div class="stage-copy">
          <span class="stage-kicker"><span class="live-dot"></span> ESPACIO DE TRABAJO</span>
          <h1>Tu librería,<br><em>en equilibrio.</em></h1>
          <p>Organiza tu inventario, atiende a tus clientes y registra tus ventas.</p>
        </div>
        <div class="authkit-caption" aria-hidden="true"><span>01 / MARANATHA STORE</span><span>INVENTARIO · CLIENTES · VENTAS</span></div>
      </section>

      <section class="login-panel">
        <div class="login-panel-top">
          <div class="login-panel-brand"><img class="maranatha-brand-image panel-brand-image" src="/maranatha-logo.png" alt="Librería Maranatha" (error)="onLogoError($event)"><span class="brand-fallback">MARANATHA STORE</span></div>
          <button type="button" class="login-theme-toggle" (click)="toggleTheme()"
            [attr.aria-pressed]="darkMode"
            [attr.aria-label]="darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
            [attr.title]="darkMode ? 'Tema claro' : 'Tema oscuro'">
            <span class="login-theme-symbol" aria-hidden="true">{{ darkMode ? '☀' : '☾' }}</span>
            <span>{{ darkMode ? 'Claro' : 'Oscuro' }}</span>
          </button>
        </div>
        <form class="login-card auth-reveal" (ngSubmit)="entrar()" #loginForm="ngForm">
          <div class="login-eyebrow">BIENVENIDO DE NUEVO</div>
          <h2>Tu espacio comienza aquí.</h2>
          <p>Ingresa con tus credenciales para administrar tu librería.</p>

          <label for="usuario">Nombre de usuario</label>
          <div class="login-control">
            <input id="usuario" [(ngModel)]="usuario" name="usuario" required autocomplete="username" placeholder="Escribe tu usuario" [disabled]="cargando">
          </div>

          <label for="clave">Contraseña</label>
          <div class="login-control password-control">
            <input id="clave" [type]="mostrarClave ? 'text' : 'password'" [(ngModel)]="clave" name="clave" required autocomplete="current-password" placeholder="Escribe tu contraseña" [disabled]="cargando">
            <button type="button" class="password-toggle" (click)="mostrarClave = !mostrarClave" [attr.aria-label]="mostrarClave ? 'Ocultar contraseña' : 'Mostrar contraseña'" [attr.title]="mostrarClave ? 'Ocultar contraseña' : 'Mostrar contraseña'" [attr.aria-pressed]="mostrarClave" [disabled]="cargando">
              <svg *ngIf="!mostrarClave" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2.5 12S6 5.7 12 5.7 21.5 12 21.5 12 18 18.3 12 18.3 2.5 12 2.5 12Z"/>
                <circle cx="12" cy="12" r="2.7"/>
              </svg>
              <svg *ngIf="mostrarClave" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 9.2C3 10.3 2.5 12 2.5 12S6 18.3 12 18.3c1.3 0 2.5-.3 3.6-.8M20 14.9c1-1.1 1.5-2.9 1.5-2.9S18 5.7 12 5.7c-1.3 0-2.5.3-3.6.8"/>
                <path d="M10.2 10.2a2.6 2.6 0 0 0 3.6 3.6M3 3l18 18"/>
              </svg>
            </button>
          </div>

          <p class="login-error" *ngIf="error" role="alert">{{ error }}</p>
          <button type="submit" class="login-submit" [disabled]="cargando || loginForm.invalid">
            <span>{{ cargando ? 'Verificando acceso...' : 'Entrar al panel' }}</span><span aria-hidden="true">↗</span>
          </button>
          <a class="forgot-password-link" routerLink="/recuperar-contrasena">¿Olvidaste tu contraseña? <span aria-hidden="true">↗</span></a>
          <div class="login-secure"><span aria-hidden="true">◈</span> Acceso protegido · Maranatha Store V2</div>
        </form>
        <div class="login-panel-bottom">GESTIÓN COMERCIAL · INVENTARIO · VENTAS</div>
      </section>
    </div>
  `
})
export class LoginComponent {
  usuario = '';
  clave = '';
  error = '';
  cargando = false;
  mostrarClave = false;
  darkMode = localStorage.getItem('maranatha-ui-mode') === 'dark';

  toggleTheme(): void {
    this.darkMode = !this.darkMode;
    localStorage.setItem('maranatha-ui-mode', this.darkMode ? 'dark' : 'light');
  }
  onLogoError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  entrar(): void {
    if (!this.usuario.trim() || !this.clave || this.cargando) return;
    this.error = '';
    this.cargando = true;
    this.auth.login(this.usuario.trim(), this.clave).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (error: HttpErrorResponse) => {
        const body = error.error as ApiError;
        this.error = body?.message || (error.status === 0
          ? 'No se puede conectar con el servidor. Comprueba que el backend esté encendido.'
          : 'Usuario o contraseña incorrectos.');
        this.cargando = false;
      }
    });
  }
}
