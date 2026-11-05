import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { catchError, EMPTY, Subject, switchMap, timer } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { AjusteInventario, ApiError, Producto } from '../models';

@Component({
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, CommonModule],
  template: `
    <div class="page-title">
      <div><h2>Productos e inventario</h2><p>Control de precios y stock en PostgreSQL</p></div>
      <button class="workspace-primary" *ngIf="auth.isAdmin" (click)="nuevo()">+ Nuevo producto</button>
    </div>
    <div *ngIf="mensaje" class="notice inventory-notice" [class.error-notice]="esError" [attr.role]="esError ? 'alert' : 'status'">
      <span style="white-space:pre-line">{{ mensaje }}</span>
      <button *ngIf="esError" type="button" class="link" (click)="mensaje=''">Cerrar</button>
    </div>
    <div class="catalog-controls">
      <div class="stock-segments" role="group" aria-label="Filtro rápido de stock"><button type="button" [class.active]="filtroStock==='todos'" (click)="filtroStock='todos'">Todos</button><button type="button" [class.active]="filtroStock==='disponible'" (click)="filtroStock='disponible'">Disponibles · 6 o más</button><button type="button" [class.active]="filtroStock==='bajo'" (click)="filtroStock='bajo'">Stock bajo · 1 a 5</button><button type="button" [class.active]="filtroStock==='agotado'" (click)="filtroStock='agotado'">Sin stock</button></div>
      <div class="toolbar" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <input aria-label="Buscar productos" placeholder="Buscar por nombre, descripción o ID..." [ngModel]="q" (ngModelChange)="cambiarBusqueda($event)">
        <select aria-label="Filtrar por existencias" [(ngModel)]="filtroStock" class="stock-filter">
          <option value="todos">Todos los artículos</option>
          <option value="bajo">Stock bajo (1–5)</option>
          <option value="agotado">Sin stock (0)</option>
          <option value="disponible">Disponibles (6+)</option>
        </select>
        <form *ngIf="auth.isAdmin" [formGroup]="formImportacion">
          <button class="secondary" type="button" (click)="archivoImportar.click()" [disabled]="importando">
            {{ importando ? 'Importando Excel…' : 'Importar plantilla Excel' }}
          </button>
          <input #archivoImportar type="file" accept=".xlsx,.xls" hidden (change)="seleccionarExcel(archivoImportar)">
        </form>
        <button class="secondary" type="button" (click)="exportarVista()" [disabled]="cargandoCatalogo || !!errorCatalogo">Exportar inventario mostrado</button>
      </div>
    </div>
    <div *ngIf="errorCatalogo" class="notice inventory-notice error-notice" role="alert">
      {{ errorCatalogo }}
      <button type="button" class="link" (click)="cargar()">Reintentar</button>
    </div>
    <div class="search-result-feedback" *ngIf="!cargandoCatalogo && !errorCatalogo && (q.trim() || filtroStock !== 'todos')" aria-live="polite">
      <span aria-hidden="true">{{ filtrados.length ? '✦' : '⌕' }}</span>
      {{ filtrados.length ? (filtrados.length + ' artículo(s) encontrado(s)') : mensajeSinResultados }}
      <button type="button" class="link" (click)="filtroStock='todos'; cambiarBusqueda('')">Limpiar filtros</button>
    </div>
    <div class="table-wrap inventory-filter-results" [attr.data-stock-filter]="filtroStock">
      <table>
        <thead><tr><th>Producto</th><th>Descripción</th><th>Precio</th><th>Stock</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let p of filtrados; trackBy: trackById" [class.inventory-row-removing]="eliminandoAnimacionId === p.id">
            <td><b>{{ p.nombre }}</b><br><small>ID {{ p.id }}</small></td>
            <td>{{ p.descripcion || '-' }}</td>
            <td>S/ {{ p.precio | number:'1.2-2' }}</td>
            <td>{{ p.stock }}</td>
            <td><span [class.danger]="p.stock <= 5" class="status">{{ estadoStock(p.stock) }}</span></td>
            <td>
              <button type="button" class="link" (click)="verDetalle(p)">Ver</button>
              <button type="button" class="link" *ngIf="auth.isAdmin" (click)="editar(p)">Editar</button>
              <button type="button" class="link" *ngIf="auth.isAdmin" (click)="abrirAjuste(p)">Ajustar</button>
              <button type="button" class="link danger-text trash-eat-button" [class.trash-eating]="eliminandoAnimacionId === p.id" [disabled]="procesandoEliminar || eliminandoAnimacionId === p.id" *ngIf="auth.isAdmin" (click)="solicitarEliminar(p)" aria-label="Eliminar artículo">
                <span class="trash-bin" aria-hidden="true"><span class="trash-bin-lid"></span><span class="trash-bin-body"></span></span>
                <span class="trash-word" aria-hidden="true"><span>E</span><span>l</span><span>i</span><span>m</span><span>i</span><span>n</span><span>a</span><span>r</span></span>
              </button>
            </td>
          </tr>
          <tr *ngIf="cargandoCatalogo"><td colspan="6" class="empty" role="status">Consultando catálogo…</td></tr>
          <tr *ngIf="!cargandoCatalogo && !errorCatalogo && !filtrados.length">
            <td colspan="6" class="empty">{{ q.trim() || filtroStock !== 'todos' ? mensajeSinResultados : 'No hay productos registrados.' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="modal product-modal" *ngIf="detalle" role="presentation">
      <section class="dialog inventory-dialog" role="dialog" aria-modal="true" aria-label="Detalle del producto">
        <span class="product-dialog-eyebrow">FICHA DEL ARTÍCULO</span>
        <h3>{{ detalle.nombre }}</h3>
        <p>{{ detalle.descripcion || 'Sin descripción' }}</p>
        <dl class="inventory-details">
          <div><dt>ID del producto</dt><dd>{{ detalle.id }}</dd></div>
          <div><dt>Precio</dt><dd>S/ {{ detalle.precio | number:'1.2-2' }}</dd></div>
          <div><dt>Stock</dt><dd>{{ detalle.stock }}</dd></div>
          <div><dt>Estado</dt><dd>{{ estadoStock(detalle.stock) }}</dd></div>
        </dl>
        <section *ngIf="auth.isAdmin" aria-label="Historial de ajustes">
          <h4>Historial de ajustes</h4>
          <p *ngIf="cargandoHistorial" role="status">Cargando historial…</p>
          <p *ngIf="errorHistorial" class="product-form-error" role="alert">{{ errorHistorial }}</p>
          <ng-container *ngIf="!cargandoHistorial && !errorHistorial">
            <p *ngIf="!historial.length">Todavía no hay ajustes registrados.</p>
            <ol *ngIf="historial.length" style="max-height: 12rem; overflow: auto;">
              <li *ngFor="let ajuste of historial">
                <strong>{{ ajuste.tipo === 'REPONER' ? '+' : '−' }}{{ ajuste.cantidad }}</strong>
                · {{ ajuste.stockAnterior }} → {{ ajuste.stockNuevo }}
                · {{ ajuste.fecha | date:'dd/MM/yyyy HH:mm':'-0500' }}<br>
                {{ ajuste.motivo }}
              </li>
            </ol>
          </ng-container>
        </section>
        <div class="actions"><button type="button" (click)="detalle=null">Cerrar</button></div>
      </section>
    </div>
    <div class="modal product-modal" *ngIf="ajusteProducto" role="presentation">
      <form class="dialog inventory-dialog" role="dialog" aria-modal="true" aria-label="Ajustar stock" (ngSubmit)="confirmarAjuste()">
        <span class="product-dialog-eyebrow">CONTROL DE INVENTARIO</span>
        <h3>Ajustar stock</h3>
        <p>{{ ajusteProducto.nombre }}</p>
        <p>Stock actual: <strong>{{ ajusteProducto.stock }}</strong></p>
        <label>Operación
          <select name="tipoAjuste" [(ngModel)]="tipoAjuste"><option value="reponer">Reponer (sumar)</option><option value="descontar">Descontar (restar)</option></select>
        </label>
        <label>Cantidad
          <input name="cantidadAjuste" type="number" min="1" step="1" [(ngModel)]="cantidadAjuste" required>
        </label>
        <div class="inventory-preview">Stock estimado: <strong>{{ stockEstimado }}</strong></div>
        <label>Motivo del ajuste <span class="required-star">*</span>
          <textarea name="motivoAjuste" [(ngModel)]="motivoAjuste" maxlength="250" rows="2"
            placeholder="Ej. Conteo físico o producto dañado" required></textarea>
        </label>
        <div *ngIf="errorAjuste" role="alert" class="product-form-error">{{ errorAjuste }}</div>
        <div class="actions"><button type="button" class="secondary" (click)="ajusteProducto=null" [disabled]="procesandoAjuste">Cancelar</button><button type="submit" [disabled]="procesandoAjuste">{{ procesandoAjuste ? 'Aplicando...' : 'Confirmar ajuste' }}</button></div>
      </form>
    </div>
    <div class="modal product-modal" *ngIf="productoEliminar" role="presentation">
      <section class="dialog inventory-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
        <span class="product-dialog-eyebrow">CONFIRMAR ACCIÓN</span><h3 id="delete-title">¿Eliminar artículo?</h3>
        <p>Confirma si deseas eliminar <strong>{{ productoEliminar.nombre }}</strong> del catálogo.</p>
        <p>Solo se pueden eliminar productos sin stock ni ventas asociadas.</p>
        <p *ngIf="errorEliminar" class="product-form-error" role="alert">{{ errorEliminar }}</p>
        <div class="actions"><button type="button" class="secondary" (click)="productoEliminar=null" [disabled]="procesandoEliminar">Cancelar</button><button type="button" class="danger-button" (click)="confirmarEliminar()" [disabled]="procesandoEliminar">{{ procesandoEliminar ? 'Eliminando...' : 'Sí, eliminar' }}</button></div>
      </section>
    </div>
    <div class="modal product-modal" *ngIf="abierto" role="presentation">
      <form class="dialog product-dialog" (ngSubmit)="guardar()" role="dialog" aria-modal="true" aria-labelledby="titulo-producto" novalidate>
        <div class="product-dialog-head">
          <div>
            <span class="product-dialog-eyebrow">MARANATHA · CATÁLOGO</span>
            <h3 id="titulo-producto">{{ form.id ? 'Editar artículo' : 'Registrar nuevo artículo' }}</h3>
            <p>Completa la información para mantener actualizado tu inventario.</p>
          </div>
          <button class="product-dialog-close" type="button" (click)="cerrarModal()" aria-label="Cerrar formulario">×</button>
        </div>
        <div class="product-dialog-fields">
          <label>Nombre del artículo <span class="required-star">*</span>
            <input [(ngModel)]="form.nombre" name="nombre" required maxlength="150" placeholder="Ej. Cuaderno cuadriculado A4" [class.field-invalid]="errorFormulario && !form.nombre.trim()" (input)="limpiarError()" autofocus>
          </label>
          <label>Descripción <span class="required-star">*</span>
            <input [(ngModel)]="form.descripcion" name="descripcion" required maxlength="500" placeholder="Características del artículo" [class.field-invalid]="errorFormulario && !form.descripcion?.trim()" (input)="limpiarError()">
          </label>
          <div class="row">
            <label>Precio (S/) <span class="required-star">*</span>
              <input type="number" min="0.01" step="0.01" [(ngModel)]="form.precio" name="precio" required [class.field-invalid]="errorFormulario && (!form.precio || form.precio <= 0)" (input)="limpiarError()">
            </label>
            <label>Stock <span class="required-star">*</span>
              <input type="number" min="0" step="1" [(ngModel)]="form.stock" name="stock" required [class.field-invalid]="errorFormulario && (!esStockValido())" (input)="limpiarError()">
            </label>
          </div>
          <p class="product-field-hint">El precio debe ser mayor que cero y el stock debe ser un número entero no negativo.</p>
          <div class="product-form-error" *ngIf="errorFormulario" role="alert"><span aria-hidden="true">!</span>{{ errorFormulario }}</div>
        </div>
        <div class="actions product-dialog-actions">
          <button type="button" class="secondary" (click)="cerrarModal()" [disabled]="procesando">Cancelar</button>
          <button type="submit" class="workspace-primary" [disabled]="procesando">{{ procesando ? 'Guardando...' : (form.id ? 'Guardar cambios' : 'Registrar artículo') }}</button>
        </div>
      </form>
    </div>
  `
})
export class ProductosComponent implements OnInit {
  readonly auth=inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly consultas = new Subject<number>();
  cargandoCatalogo = true;
  errorCatalogo = '';
  readonly formImportacion = new FormGroup({
    archivo: new FormControl<File | null>(null, control => {
      const archivo: File | null = control.value;
      if (!archivo) return { required: true };
      if (!/\.(xlsx|xls)$/i.test(archivo.name)) return { formato: true };
      if (!archivo.size) return { vacio: true };
      if (archivo.size > 5 * 1024 * 1024) return { tamano: true };
      return null;
    })
  });
  lista: Producto[] = [];
  q = '';
  filtroStock: 'todos' | 'bajo' | 'agotado' | 'disponible' = 'todos';
  detalle: Producto | null = null;
  historial: AjusteInventario[] = [];
  cargandoHistorial = false;
  errorHistorial = '';
  errorEliminar = '';
  ajusteProducto: Producto | null = null;
  productoEliminar: Producto | null = null;
  cantidadAjuste = 1;
  motivoAjuste = '';
  tipoAjuste: 'reponer' | 'descontar' = 'reponer';
  procesandoAjuste = false;
  procesandoEliminar = false;
  eliminandoAnimacionId?: number;
  importando = false;
  errorAjuste = '';
  private mensajeTimer?: ReturnType<typeof setTimeout>;
  abierto = false;
  procesando = false;
  mensaje = '';
  esError = false;
  errorFormulario = '';
  form: Producto = this.vacio();

  get filtrados(): Producto[] {
    if (this.cargandoCatalogo || this.errorCatalogo) return [];
    return this.lista.filter(p => this.filtroStock === 'todos'
      || (this.filtroStock === 'bajo' && p.stock >= 1 && p.stock <= 5)
      || (this.filtroStock === 'agotado' && p.stock === 0)
      || (this.filtroStock === 'disponible' && p.stock > 5));
  }

  get mensajeSinResultados(): string {
    const busqueda = this.q.trim();
    if (/^\d+$/.test(busqueda) && !this.lista.length) {
      return `No se encontró un producto con el ID ${busqueda}.`;
    }
    return 'No encontramos artículos con estos filtros. Prueba otro nombre, ID o estado.';
  }

  estadoStock(stock: number): string {
    if (stock === 0) return 'Sin stock';
    return stock <= 5 ? 'Stock bajo' : 'Disponible';
  }

  ngOnInit(): void {
    this.consultas.pipe(
      switchMap(espera => {
        const consulta = this.q.trim();
        this.cargandoCatalogo = true;
        this.errorCatalogo = '';
        return timer(espera).pipe(
          switchMap(() => this.api.productos(consulta)),
          catchError(error => {
            this.cargandoCatalogo = false;
            this.errorCatalogo = this.extraerMensaje(error, 'No se pudieron cargar los productos.');
            return EMPTY;
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(productos => {
      this.lista = productos;
      this.cargandoCatalogo = false;
    });
    this.cargar();
  }

  cambiarBusqueda(consulta: string): void {
    this.q = consulta;
    this.consultas.next(250);
  }

  get stockEstimado(): number {
    if (!this.ajusteProducto) return 0;
    return this.ajusteProducto.stock + (this.tipoAjuste === 'reponer' ? 1 : -1) * (Number(this.cantidadAjuste) || 0);
  }

  verDetalle(p: Producto): void {
    this.detalle = p;
    this.historial = [];
    this.errorHistorial = '';
    this.cargandoHistorial = false;
    if (!p.id || !this.auth.isAdmin) return;
    this.cargandoHistorial = true;
    this.api.historialAjustes(p.id).subscribe({
      next: historial => {
        if (this.detalle !== p) return;
        this.historial = historial;
        this.cargandoHistorial = false;
      },
      error: error => {
        if (this.detalle !== p) return;
        this.errorHistorial = this.extraerMensaje(error, 'No se pudo cargar el historial de ajustes.');
        this.cargandoHistorial = false;
      }
    });
  }

  abrirAjuste(p: Producto): void {
    this.ajusteProducto = p;
    this.cantidadAjuste = 1;
    this.tipoAjuste = 'reponer';
    this.motivoAjuste = '';
    this.errorAjuste = '';
  }

  confirmarAjuste(): void {
    const p = this.ajusteProducto;
    const cantidad = Number(this.cantidadAjuste);
    if (!p?.id || this.procesandoAjuste) return;
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      this.errorAjuste = 'Ingresa una cantidad entera mayor que cero.'; return;
    }
    if (this.tipoAjuste === 'descontar' && cantidad > p.stock) {
      this.errorAjuste = 'La cantidad supera el stock disponible.'; return;
    }
    const motivo = this.motivoAjuste.trim();
    if (!motivo) {
      this.errorAjuste = 'Ingresa el motivo del ajuste.';
      return;
    }
    this.procesandoAjuste = true;
    const tipo = this.tipoAjuste === 'reponer' ? 'REPONER' : 'DESCONTAR';
    this.api.ajustarStock(p.id, tipo, cantidad, motivo).subscribe({
      next: () => {
        this.procesandoAjuste = false;
        this.ajusteProducto = null;
        this.mostrarMensaje('Ajuste guardado. Puedes consultarlo en Ver → Historial de ajustes.');
        this.cargar();
      },
      error: e => { this.procesandoAjuste = false; this.errorAjuste = this.extraerMensaje(e, 'No se pudo actualizar el stock.'); }
    });
  }

  solicitarEliminar(p: Producto): void {
    this.errorEliminar = '';
    this.productoEliminar = p;
  }

  confirmarEliminar(): void {
    const p = this.productoEliminar;
    if (!p?.id || this.procesandoEliminar) return;
    this.errorEliminar = '';
    this.procesandoEliminar = true;
    this.api.eliminarProducto(p.id).subscribe({
      next: () => {
        this.productoEliminar = null;
        this.eliminandoAnimacionId = p.id;
        setTimeout(() => {
          this.procesandoEliminar = false;
          this.eliminandoAnimacionId = undefined;
          this.mostrarMensaje('Producto eliminado correctamente.');
          this.cargar();
        }, 700);
      },
      error: e => {
        this.procesandoEliminar = false;
        this.errorEliminar = this.extraerMensaje(e, 'No se pudo eliminar el producto.');
      }
    });
  }

  async exportarVista(): Promise<void> {
    const XLSX = await import('xlsx');
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(this.filtrados.map(p => ({ ID: p.id, Producto: p.nombre, Descripcion: p.descripcion, Precio: p.precio, Stock: p.stock, Estado: p.activo === false ? 'INACTIVO' : 'ACTIVO' }))), 'Inventario');
    XLSX.writeFile(libro, 'inventario-mostrado.xlsx');
  }
  async descargarPlantilla(): Promise<void> {
    const XLSX = await import('xlsx');
    const hoja = XLSX.utils.json_to_sheet([
      { Nombre: 'Ejemplo cuaderno', Descripcion: 'Cuaderno de prueba', Precio: 4.5, Stock: 10, Activo: 'SI' },
      { Nombre: 'Ejemplo lápiz', Descripcion: 'Lápiz de prueba', Precio: 1.5, Stock: 12, Activo: 'SI' }
    ]);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Articulos');
    XLSX.writeFile(libro, 'Plantilla_Maranatha_Articulos.xlsx');
  }

  cargar(): void {
    this.consultas.next(0);
  }

  cerrarModal(): void {
    if (!this.procesando) this.abierto = false;
  }

  limpiarError(): void {
    if (this.errorFormulario) this.errorFormulario = '';
  }

  esStockValido(): boolean {
    return this.form.stock != null && Number.isInteger(Number(this.form.stock)) && Number(this.form.stock) >= 0;
  }

  nuevo(): void {
    this.form = this.vacio();
    this.errorFormulario = '';
    this.abierto = true;
  }

  editar(producto: Producto): void {
    this.form = { ...producto };
    this.errorFormulario = '';
    this.abierto = true;
  }

  guardar(): void {
    this.errorFormulario = '';
    if (!this.form.nombre.trim()) {
      this.errorFormulario = 'Ingrese el nombre del producto.';
      return;
    }
    if (!this.form.descripcion?.trim()) {
      this.errorFormulario = 'Ingrese la descripción del producto.';
      return;
    }
    if (this.form.precio == null || !Number.isFinite(Number(this.form.precio)) || Number(this.form.precio) <= 0) {
      this.errorFormulario = 'El precio debe ser mayor que cero.';
      return;
    }
    if (Number(this.form.precio.toFixed(2)) !== this.form.precio) {
      this.errorFormulario = 'El precio admite hasta dos decimales.';
      return;
    }
    if (!this.esStockValido()) {
      this.errorFormulario = 'El stock debe ser un número entero no negativo.';
      return;
    }

    this.form.nombre = this.form.nombre.trim();
    this.form.descripcion = this.form.descripcion.trim();
    this.procesando = true;
    const operacion = this.form.id
      ? this.api.actualizarProducto(this.form)
      : this.api.crearProducto(this.form);
    operacion.subscribe({
      next: () => {
        this.procesando = false;
        this.abierto = false;
        this.mostrarMensaje('Producto guardado correctamente.');
        this.cargar();
      },
      error: error => {
        this.procesando = false;
        this.errorFormulario = this.extraerMensaje(error, 'No se pudo guardar el producto.');
      }
    });
  }


  seleccionarExcel(input: HTMLInputElement): void {
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo || this.importando) return;

    const control = this.formImportacion.controls.archivo;
    control.setValue(archivo);
    if (this.formImportacion.invalid) {
      const mensaje = control.hasError('tamano') ? 'El archivo Excel no puede superar 5 MB.'
        : control.hasError('vacio') ? 'El archivo Excel está vacío.'
        : 'Selecciona un archivo Excel (.xlsx o .xls).';
      this.mostrarErrorSimple(mensaje);
      this.formImportacion.reset();
      return;
    }

    this.importando = true;
    this.mensaje = '';
    this.api.importarProductos(archivo).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: resultado => {
        this.importando = false;
        this.formImportacion.reset();
        this.mostrarMensaje(`Importación completada: ${resultado.nuevos} nuevos, ${resultado.actualizados} actualizados y ${resultado.sinCambios} sin cambios.`);
        if (resultado.nuevos || resultado.actualizados) this.cargar();
      },
      error: error => {
        this.importando = false;
        this.formImportacion.reset();
        this.mostrarErrorSimple(this.extraerMensaje(error, 'No se pudo importar el archivo Excel.'));
      }
    });
  }

  trackById(_: number, item: Producto): number | undefined { return item.id; }

  private vacio(): Producto { return { nombre: '', descripcion: '', precio: 0, stock: 0, activo: true }; }
  private mostrarMensaje(mensaje: string): void {
    this.mensaje = mensaje; this.esError = false; this.programarLimpiarMensaje();
  }
  private mostrarErrorSimple(mensaje: string): void {
    clearTimeout(this.mensajeTimer);
    this.mensaje = mensaje;
    this.esError = true;
  }
  private programarLimpiarMensaje(): void {
    if (this.mensajeTimer) clearTimeout(this.mensajeTimer);
    this.mensajeTimer = setTimeout(() => this.mensaje = '', 5500);
  }
  private extraerMensaje(error: HttpErrorResponse, fallback: string): string {
    return (error.error as ApiError)?.message || (error.status === 0 ? 'No hay conexión con el backend.' : fallback);
  }
}
