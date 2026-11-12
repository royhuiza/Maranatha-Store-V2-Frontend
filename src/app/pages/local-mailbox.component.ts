import { CommonModule, Location } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { OriginkitSceneComponent } from '../core/originkit-scene.component';
import { ThemePreference } from '../core/theme-preference';

interface Message {
  ID: string;
  Subject: string;
  Created: string;
  To?: Array<{ Address: string }>;
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, OriginkitSceneComponent],
  template: `
    <main class="recovery-page mailbox-page" [class.mailbox-dark]="theme.dark()">
      <app-originkit-scene effect="reactive" />
      <div class="mailbox-shell">
        <header class="recovery-header">
          <img src="/maranatha-logo.png" alt="Librería Maranatha">
          <div class="mailbox-actions">
            <a class="login-theme-toggle" routerLink="/recuperar-contrasena">← Volver a recuperación</a>
            <button type="button" class="login-theme-toggle theme-switch" (click)="theme.toggle($event, view)"
              [attr.aria-pressed]="theme.dark()"
              [attr.aria-label]="theme.dark() ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'">
              {{ theme.dark() ? '☀ Claro' : '☾ Oscuro' }}
            </button>
          </div>
        </header>

        <section class="mailbox-intro">
          <span class="recovery-eyebrow recovery-status">ENTORNO LOCAL DE PRUEBAS</span>
          <h1>Buzón de Maranatha</h1>
          <p>Abre el mensaje más reciente para crear tu nueva contraseña. Este buzón está disponible en el entorno local de desarrollo.</p>
        </section>
        <div class="mailbox-toolbar">
          <span *ngIf="destinatario && !mostrarTodos">Mensajes para <strong>{{ destinatario }}</strong></span>
          <span *ngIf="!destinatario || mostrarTodos">Todos los mensajes del buzón</span>
          <div class="mailbox-actions">
            <button *ngIf="destinatario" type="button" class="secondary" (click)="alternarDestinatario()">
              {{ mostrarTodos ? 'Solo mi correo' : 'Ver todos' }}
            </button>
            <button type="button" (click)="cargar()" [disabled]="cargando">{{ cargando ? 'Actualizando…' : 'Actualizar' }}</button>
          </div>
        </div>
        <p class="error" *ngIf="error" role="alert">{{ error }}</p>

        <section class="mailbox-grid">
          <div class="mailbox-list" aria-label="Mensajes del buzón">
            <button type="button" *ngFor="let mensaje of visibles; trackBy: identificar" (click)="abrir(mensaje)"
              [class.active]="seleccionado === mensaje.ID" [attr.aria-pressed]="seleccionado === mensaje.ID">
              <b>{{ mensaje.Subject }}</b>
              <span>{{ destinatarios(mensaje) }}</span>
              <small>{{ mensaje.Created | date:'dd/MM/yyyy HH:mm:ss':'-0500' }}</small>
            </button>
            <p *ngIf="!visibles.length && !cargando && !error">Todavía no hay mensajes para mostrar. Solicita un enlace desde recuperación.</p>
          </div>
          <article class="mailbox-message" aria-live="polite">
            <h2>{{ asunto || 'Enlace de recuperación' }}</h2>
            <ng-container *ngIf="token; else mensajeCompleto">
              <p>El enlace del mensaje vence en 15 minutos y solo se usa una vez.</p>
              <a class="save-pdf-link" routerLink="/recuperar-contrasena" [queryParams]="{ token: token }">Crear nueva contraseña</a>
            </ng-container>
            <ng-template #mensajeCompleto>
              <pre *ngIf="texto">{{ texto }}</pre>
              <p *ngIf="!asunto">El contenido aparecerá aquí cuando llegue un mensaje.</p>
            </ng-template>
          </article>
        </section>
      </div>
    </main>
  `
})
export class LocalMailboxComponent implements OnInit, OnDestroy {
  readonly theme = inject(ThemePreference);
  readonly view = inject(ChangeDetectorRef);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly navigationState = inject(Router).getCurrentNavigation()?.extras.state
    ?? inject(Location).getState() as { destinatario?: unknown } | null;
  readonly destinatario = typeof this.navigationState?.['destinatario'] === 'string'
    ? this.navigationState['destinatario'].trim() : '';
  private timer?: ReturnType<typeof setInterval>;
  private messageRequest?: Subscription;
  mensajes: Message[] = [];
  mostrarTodos = false;
  cargando = false;
  error = '';
  seleccionado = '';
  texto = '';
  asunto = '';
  token = '';

  ngOnInit(): void {
    this.cargar();
    this.timer = setInterval(() => { if (!document.hidden) this.cargar(); }, 5000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  identificar(_: number, mensaje: Message): string { return mensaje.ID; }

  destinatarios(mensaje: Message): string {
    return (mensaje.To ?? []).map(t => t.Address).join(', ');
  }

  get visibles(): Message[] {
    if (!this.destinatario || this.mostrarTodos) return this.mensajes;
    const correo = this.destinatario.toLowerCase();
    return this.mensajes.filter(mensaje => mensaje.To?.some(t => t.Address.toLowerCase() === correo));
  }

  alternarDestinatario(): void {
    this.mostrarTodos = !this.mostrarTodos;
    this.seleccionarDisponible();
  }

  cargar(): void {
    if (this.cargando) return;
    this.cargando = true;
    this.http.get<{ messages: Message[] }>('/correo-pruebas-api/messages')
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: respuesta => {
          this.mensajes = (respuesta.messages ?? []).slice().sort((a, b) => b.Created.localeCompare(a.Created));
          this.cargando = false;
          this.error = '';
          this.seleccionarDisponible();
        },
        error: () => {
          this.cargando = false;
          this.error = 'No se pudo abrir el buzón local. Comprueba Mailpit y reinicia el frontend con npm start.';
        }
      });
  }

  abrir(mensaje: Message): void {
    this.messageRequest?.unsubscribe();
    this.seleccionado = mensaje.ID;
    this.asunto = mensaje.Subject;
    this.token = '';
    this.texto = 'Cargando mensaje…';
    this.messageRequest = this.http.get<{ Text: string }>('/correo-pruebas-api/message/' + encodeURIComponent(mensaje.ID))
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: respuesta => {
          this.texto = respuesta.Text ?? '';
          const enlace = this.texto.match(/https?:\/\/(?:localhost|127\.0\.0\.1):4200\/recuperar-contrasena\?token=([A-Za-z0-9_-]{40,100})(?![A-Za-z0-9_-])/);
          this.token = enlace?.[1] ?? '';
        },
        error: () => this.texto = 'No se pudo cargar el mensaje.'
      });
  }

  private seleccionarDisponible(): void {
    const opciones = this.visibles;
    if (opciones.some(mensaje => mensaje.ID === this.seleccionado)) return;
    if (opciones.length) {
      this.abrir(opciones[0]);
      return;
    }
    this.messageRequest?.unsubscribe();
    this.seleccionado = this.asunto = this.texto = this.token = '';
  }
}
