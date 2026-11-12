import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ApiError, Cliente } from '../models';

@Component({
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="page-title">
      <div><h2>Clientes</h2><p>Personas y empresas</p></div>
      <button class="workspace-primary" (click)="nuevo()">+ Nuevo cliente</button>
    </div>
    <div *ngIf="mensaje" class="notice" [class.error-notice]="esError">{{ mensaje }}</div>
    <div class="toolbar"><input aria-label="Buscar clientes" placeholder="Buscar por nombre o documento..." [(ngModel)]="q"></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Cliente</th><th>Documento</th><th>Contacto</th><th>Dirección</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let c of filtrados; trackBy: trackById">
            <td><b>{{ c.nombre }} {{ c.apellido }}</b></td>
            <td>{{ c.tipoDocumento || 'DNI' }} {{ c.numeroDocumento || '-' }}</td>
            <td>{{ c.telefono || '-' }}<br><small>{{ c.email || '-' }}</small></td>
            <td>{{ c.direccion || '-' }}</td>
            <td><button class="link" (click)="editar(c)">Editar</button><button class="link danger-text" *ngIf="auth.isAdmin" (click)="eliminar(c)">Eliminar</button></td>
          </tr>
          <tr *ngIf="!filtrados.length"><td colspan="5" class="empty">No hay clientes registrados.</td></tr>
        </tbody>
      </table>
    </div>

    <div class="modal" *ngIf="abierto">
      <form class="dialog" (ngSubmit)="guardar()">
        <h3>{{ form.id ? 'Editar' : 'Nuevo' }} cliente</h3>
        <div class="row">
          <label>Nombres<input [(ngModel)]="form.nombre" name="nombre" required maxlength="100"></label>
          <label>Apellidos<input [(ngModel)]="form.apellido" name="apellido" maxlength="100"></label>
        </div>
        <div class="row">
          <label>Tipo de documento
            <select [(ngModel)]="form.tipoDocumento" name="tipo">
            <option>DNI</option>
            <option>RUC</option>
            <option>CE</option>
            </select>
          </label>
          <label>
            Número
            <input
              [(ngModel)]="form.numeroDocumento"
              name="numeroDocumento"
              maxlength="20"
              (ngModelChange)="errorFormulario = ''">
          </label>
        </div>


        <div *ngIf="form.tipoDocumento === 'RUC'">
          <button
            type="button"
            class="secondary"
            (click)="consultarRuc()"
            [disabled]="consultandoRuc || procesando">
            {{ consultandoRuc ? 'Consultando...' : 'Consultar SUNAT' }}
          </button>
        </div>

        <div class="row">
          <label>Teléfono<input [(ngModel)]="form.telefono" name="telefono" maxlength="30"></label>
          <label>Email<input type="email" [(ngModel)]="form.email" name="email" maxlength="120"></label>
        </div>
        <label>Dirección<input [(ngModel)]="form.direccion" name="direccion" maxlength="250"></label>
        <small class="error" *ngIf="errorFormulario">{{ errorFormulario }}</small>
        <div class="actions">
          <button type="button" class="secondary" (click)="abierto=false" [disabled]="procesando">Cancelar</button>
          <button class="workspace-primary" [disabled]="procesando">{{ procesando ? 'Guardando...' : 'Guardar' }}</button>
        </div>
      </form>
    </div>
  `
})
export class ClientesComponent implements OnInit {
  readonly auth=inject(AuthService);
  private readonly api = inject(ApiService);
  lista: Cliente[] = [];
  q = '';
  abierto = false;
  procesando = false;
  consultandoRuc = false;
  mensaje = '';
  esError = false;
  errorFormulario = '';
  form: Cliente = this.vacio();

  get filtrados(): Cliente[] {
    const texto = this.q.toLowerCase().trim();
    return this.lista.filter(c => `${c.nombre} ${c.apellido || ''} ${c.numeroDocumento || ''}`.toLowerCase().includes(texto));
  }

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.api.clientes().subscribe({
      next: clientes => this.lista = clientes,
      error: error => this.mostrarError(error, 'No se pudieron cargar los clientes.')
    });
  }

  nuevo(): void { this.form = this.vacio(); this.errorFormulario = ''; this.abierto = true; }
  editar(cliente: Cliente): void { this.form = { ...cliente }; this.errorFormulario = ''; this.abierto = true; }

  consultarRuc(): void {
    this.errorFormulario = '';

    const ruc = (this.form.numeroDocumento || '').trim();

    if (!/^\d{11}$/.test(ruc)) {
      this.errorFormulario = 'Ingrese un RUC de 11 dígitos.';
      return;
    }

    this.consultandoRuc = true;

    this.api.buscarRuc(ruc).subscribe({
      next: datos => {
        this.consultandoRuc = false;

        if (this.form.numeroDocumento !== ruc) {
          return;
        }

        this.form.nombre = datos.razonSocial;
        this.form.apellido = '';
        this.form.direccion = datos.direccionFiscal || '';

        this.errorFormulario = '';
      },
      error: (error: HttpErrorResponse) => {
        this.consultandoRuc = false;

        if (error.status === 503) {
          this.errorFormulario =
            'La consulta RUC oficial todavía no está disponible. Puede ingresar los datos manualmente.';
        } else if (error.status === 401) {
          this.errorFormulario =
            'El servicio de facturación no autorizó la consulta RUC. Ingrese los datos manualmente.';
        } else {
          this.errorFormulario =
            'No se pudo consultar el RUC. Verifique el número o la conexión.';
        }
      }
    });
  }

  guardar(): void {
    this.errorFormulario = '';
    if (!this.form.nombre.trim()) {
      this.errorFormulario = 'Ingrese el nombre del cliente.';
      return;
    }
    const documento = (this.form.numeroDocumento || '').trim();
    if (this.form.tipoDocumento === 'DNI' && documento && !/^\d{8}$/.test(documento)) {
      this.errorFormulario = 'El DNI debe tener 8 dígitos.';
      return;
    }
    if (this.form.tipoDocumento === 'RUC' && documento && !/^\d{11}$/.test(documento)) {
      this.errorFormulario = 'El RUC debe tener 11 dígitos.';
      return;
    }

    this.procesando = true;
    const operacion = this.form.id ? this.api.actualizarCliente(this.form) : this.api.crearCliente(this.form);
    operacion.subscribe({
      next: () => {
        this.procesando = false;
        this.abierto = false;
        this.mostrarMensaje('Cliente guardado correctamente.');
        this.cargar();
      },
      error: error => {
        this.procesando = false;
        this.errorFormulario = this.extraerMensaje(error, 'No se pudo guardar el cliente.');
      }
    });
  }

  eliminar(cliente: Cliente): void {
    if (!cliente.id || !confirm(`¿Eliminar a ${cliente.nombre}?`)) return;
    this.api.eliminarCliente(cliente.id).subscribe({
      next: () => { this.mostrarMensaje('Cliente eliminado.'); this.cargar(); },
      error: error => this.mostrarError(error, 'No se pudo eliminar el cliente.')
    });
  }

  trackById(_: number, item: Cliente): number | undefined { return item.id; }
  private vacio(): Cliente { return { nombre: '', apellido: '', tipoDocumento: 'DNI', numeroDocumento: '', email: '', telefono: '', direccion: '', activo: true }; }
  private mostrarMensaje(mensaje: string): void { this.mensaje = mensaje; this.esError = false; }
  private mostrarError(error: HttpErrorResponse, fallback: string): void { this.mensaje = this.extraerMensaje(error, fallback); this.esError = true; }
  private extraerMensaje(error: HttpErrorResponse, fallback: string): string {
    return (error.error as ApiError)?.message || (error.status === 0 ? 'No hay conexión con el backend.' : fallback);
  }
}
