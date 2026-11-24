import { CommonModule, Location } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { OriginkitSceneComponent } from '../../core/originkit-scene.component';
import { ThemePreference } from '../../core/theme-preference';

interface Message {
  ID: string;
  Subject: string;
  Created: string;
  To?: Array<{ Address: string }>;
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, OriginkitSceneComponent],
  styleUrls: ['./buzon.css'], templateUrl: './buzon.html'
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
