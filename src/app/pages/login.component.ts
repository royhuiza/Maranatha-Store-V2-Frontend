import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ApiError } from '../models';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="login-page login-experience" [class.login-dark]="darkMode">
      <section class="login-stage" [class.stage-private]="campoActivo === 'password'" [class.stage-attentive]="campoActivo === 'user'" aria-label="Bienvenida a Maranatha Store">
        <div class="login-stage-pattern" aria-hidden="true"></div>
        <div class="stage-top"><img class="maranatha-brand-image stage-brand-image" src="/maranatha-logo.png" alt="Librería Maranatha" (error)="onLogoError($event)"><span class="brand-fallback">MARANATHA / STORE</span></div>
        <div class="stage-copy">
          <span class="stage-kicker"><span class="live-dot"></span> TU ESPACIO DE TRABAJO</span>
          <h1>Todo en orden.<br><em>Todo en movimiento.</em></h1>
          <p>Productos, existencias y ventas de tu librería, organizados en un solo lugar.</p>
        </div>
        <div class="stage-art" aria-hidden="true">
          <div class="stage-art-glow"></div>
          <div class="floating-note note-first"><span class="note-icon">▤</span><span>Inventario <b>al día</b></span></div>
          <div class="floating-note note-second"><span class="note-icon">↗</span><span>Ventas <b>organizadas</b></span></div>
          <div class="stacked-book book-back"></div>
          <div class="stacked-book book-middle"></div>
          <div class="stacked-book book-front"><span class="book-mark">M.</span><span class="book-lines"></span></div>
          <svg class="walking-mascot" viewBox="0 0 110 156" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="53" cy="146" rx="33" ry="7" fill="#13383B" opacity=".14"/>
            <g class="mascot-body">
              <circle cx="55" cy="39" r="18" fill="#F3C49A"/>
              <path d="M37 40C35 19 45 14 57 14C69 14 76 23 74 34C62 30 54 23 43 31Z" fill="#173B40"/>
              <g class="mascot-eyes"><circle cx="48" cy="42" r="1.8" fill="#173B40"/><circle cx="62" cy="42" r="1.8" fill="#173B40"/></g>
              <path d="M51 49Q55 53 59 49" stroke="#AE6C50" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M45 62C37 63 29 72 27 85L21 111H88L82 82C80 70 72 62 64 62Z" fill="#F6F1E5" stroke="#173B40" stroke-width="3"/>
              <path d="M44 65L55 80L65 64" stroke="#DB9547" stroke-width="5" stroke-linecap="round"/>
              <path d="M40 80H71" stroke="#D7B78A" stroke-width="2" stroke-linecap="round"/>
              <path class="mascot-arm-left" d="M27 78L11 96L19 110" stroke="#F3C49A" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
              <path class="mascot-arm-right" d="M83 78L99 94L91 108" stroke="#F3C49A" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
              <path class="mascot-leg-left" d="M42 111L31 136L20 140" stroke="#173B40" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
              <path class="mascot-leg-right" d="M67 111L77 135L89 140" stroke="#173B40" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
              <rect x="16" y="137" width="19" height="8" rx="4" fill="#DB9547"/>
              <rect x="78" y="137" width="19" height="8" rx="4" fill="#DB9547"/>
              <rect x="36" y="89" width="37" height="25" rx="4" fill="#DFA860" stroke="#173B40" stroke-width="2"/>
              <path d="M43 96H64M43 101H59" stroke="#173B40" stroke-width="2" opacity=".6"/>
              <g class="mascot-cover-eyes">
                <path d="M27 82L42 43" stroke="#F3C49A" stroke-width="10" stroke-linecap="round"/>
                <path d="M83 82L67 43" stroke="#F3C49A" stroke-width="10" stroke-linecap="round"/>
                <ellipse cx="43" cy="43" rx="8" ry="5" transform="rotate(-21 43 43)" fill="#F3C49A"/>
                <ellipse cx="67" cy="43" rx="8" ry="5" transform="rotate(21 67 43)" fill="#F3C49A"/>
              </g>
            </g>
          </svg>
          <div class="stage-ground"></div>
        </div>
        <p class="stage-footnote">DISEÑADO PARA LA LIBRERÍA DE CADA DÍA · 2026</p>
      </section>

<!-- Entrada animada: el personaje camina y tira del panel de acceso. -->
      <div class="login-drag-layer" aria-hidden="true">
        <span class="login-drag-rope"></span>
        <svg class="login-drag-mascot" viewBox="0 0 110 156" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="53" cy="146" rx="33" ry="7" fill="#13383B" opacity=".14"/>
            <g class="mascot-body">
              <circle cx="55" cy="39" r="18" fill="#F3C49A"/>
              <path d="M37 40C35 19 45 14 57 14C69 14 76 23 74 34C62 30 54 23 43 31Z" fill="#173B40"/>
              <g class="mascot-eyes"><circle cx="48" cy="42" r="1.8" fill="#173B40"/><circle cx="62" cy="42" r="1.8" fill="#173B40"/></g>
              <path d="M51 49Q55 53 59 49" stroke="#AE6C50" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M45 62C37 63 29 72 27 85L21 111H88L82 82C80 70 72 62 64 62Z" fill="#F6F1E5" stroke="#173B40" stroke-width="3"/>
              <path d="M44 65L55 80L65 64" stroke="#DB9547" stroke-width="5" stroke-linecap="round"/>
              <path d="M40 80H71" stroke="#D7B78A" stroke-width="2" stroke-linecap="round"/>
              <path class="mascot-arm-left" d="M27 78L11 96L19 110" stroke="#F3C49A" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
              <path class="mascot-arm-right" d="M83 78L99 94L91 108" stroke="#F3C49A" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
              <path class="mascot-leg-left" d="M42 111L31 136L20 140" stroke="#173B40" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
              <path class="mascot-leg-right" d="M67 111L77 135L89 140" stroke="#173B40" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
              <rect x="16" y="137" width="19" height="8" rx="4" fill="#DB9547"/>
              <rect x="78" y="137" width="19" height="8" rx="4" fill="#DB9547"/>
              <rect x="36" y="89" width="37" height="25" rx="4" fill="#DFA860" stroke="#173B40" stroke-width="2"/>
              <path d="M43 96H64M43 101H59" stroke="#173B40" stroke-width="2" opacity=".6"/>
              <g class="mascot-cover-eyes">
                <path d="M27 82L42 43" stroke="#F3C49A" stroke-width="10" stroke-linecap="round"/>
                <path d="M83 82L67 43" stroke="#F3C49A" stroke-width="10" stroke-linecap="round"/>
                <ellipse cx="43" cy="43" rx="8" ry="5" transform="rotate(-21 43 43)" fill="#F3C49A"/>
                <ellipse cx="67" cy="43" rx="8" ry="5" transform="rotate(21 67 43)" fill="#F3C49A"/>
              </g>
            <path d="M82 83L99 67" stroke="#F3C49A" stroke-width="8" stroke-linecap="round"/>
              <circle cx="100" cy="66" r="5.5" fill="#F3C49A"/>
            </g>
          </svg>
      </div>

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
        <form class="login-card" (ngSubmit)="entrar()" #loginForm="ngForm">
          <div class="login-eyebrow">BIENVENIDO DE NUEVO</div>
          <h2>Tu espacio comienza aquí.</h2>
          <p>Ingresa con tus credenciales para administrar tu librería.</p>

          <label for="usuario">Nombre de usuario</label>
          <div class="login-control">
            <input id="usuario" [(ngModel)]="usuario" name="usuario" required autocomplete="username" placeholder="Escribe tu usuario" [disabled]="cargando" (focus)="campoActivo = 'user'" (blur)="campoActivo = 'idle'">
          </div>

          <label for="clave">Contraseña</label>
          <div class="login-control password-control">
            <input id="clave" [type]="mostrarClave ? 'text' : 'password'" [(ngModel)]="clave" name="clave" required autocomplete="current-password" placeholder="Escribe tu contraseña" [disabled]="cargando" (focus)="campoActivo = 'password'" (blur)="campoActivo = 'idle'">
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
<<<<<<< Updated upstream
          <a class="forgot-password-link" routerLink="/recuperar-contrasena">¿Olvidaste tu contraseña? <span aria-hidden="true">↗</span></a>
=======
           <div class="login-secure"><span aria-hidden="true">◈</span> Olvidaste tu conntraseña · Maranatha Store V2</div>
>>>>>>> Stashed changes
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
  campoActivo: 'idle' | 'user' | 'password' = 'idle';
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
