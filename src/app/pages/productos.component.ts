import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ApiError, Producto } from '../models';

@Component({
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="page-title">
      <div><h2>Productos e inventario</h2><p>Control de precios y stock en PostgreSQL</p></div>
      <button *ngIf="auth.isAdmin" (click)="nuevo()">+ Nuevo producto</button>
    </div>
    <div *ngIf="mensaje" class="notice inventory-notice" [class.error-notice]="esError" role="status">{{ mensaje }}</div>
    <div class="stock-segments" role="group" aria-label="Filtro rápido de stock"><button type="button" [class.active]="filtroStock==='todos'" (click)="filtroStock='todos'">Todos</button><button type="button" [class.active]="filtroStock==='disponible'" (click)="filtroStock='disponible'">Disponibles · 6 o más</button><button type="button" [class.active]="filtroStock==='bajo'" (click)="filtroStock='bajo'">Stock bajo · 1 a 5</button><button type="button" [class.active]="filtroStock==='agotado'" (click)="filtroStock='agotado'">Sin stock</button></div>
    <div class="toolbar" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <input aria-label="Buscar productos" placeholder="Buscar por nombre, descripción o ID..." [(ngModel)]="q">
      <select aria-label="Filtrar por existencias" [(ngModel)]="filtroStock" class="stock-filter">
        <option value="todos">Todos los artículos</option>
        <option value="bajo">Stock bajo (1–5)</option>
        <option value="agotado">Sin stock (0)</option>
        <option value="disponible">Disponibles (6+)</option>
      </select>
      <button class="secondary" type="button" *ngIf="auth.isAdmin" (click)="archivoImportar.click()" [disabled]="importando">Importar plantilla Excel</button>
      <button class="secondary" type="button" (click)="exportarVista()">Exportar inventario mostrado</button>
      <input #archivoImportar type="file" accept=".xlsx,.xls" hidden (change)="importarExcel($event)">
    </div>
    <div class="search-result-feedback" *ngIf="q.trim() || filtroStock !== 'todos'" aria-live="polite">
      <span aria-hidden="true">{{ filtrados.length ? '✦' : '⌕' }}</span>
      {{ filtrados.length ? (filtrados.length + ' artículo(s) encontrado(s)') : 'No encontramos artículos con estos filtros. Prueba otro nombre, ID o estado.' }}
      <button type="button" class="link" (click)="q=''; filtroStock='todos'">Limpiar filtros</button>
    </div>
    <div class="table-wrap inventory-filter-results" [attr.data-stock-filter]="filtroStock">
      <table>
        <thead><tr><th>Producto</th><th>Descripción</th><th>Precio</th><th>Stock</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let p of filtrados; trackBy: trackById" [class.inventory-row-removing]="eliminandoAnimacionId === p.id">
            <td><b>{{ p.nombre }}</b></td>
            <td>{{ p.descripcion || '-' }}</td>
            <td>S/ {{ p.precio | number:'1.2-2' }}</td>
            <td>{{ p.stock }}</td>
            <td><span [class.danger]="p.stock <= 5" class="status">{{ p.stock <= 5 ? 'Stock bajo' : 'Disponible' }}</span></td>
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
          <tr *ngIf="!filtrados.length"><td colspan="6" class="empty">{{ lista.length ? 'No se encontraron productos. Prueba otro filtro.' : 'No hay productos registrados.' }}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="modal product-modal" *ngIf="detalle" role="presentation">
      <section class="dialog inventory-dialog" role="dialog" aria-modal="true" aria-label="Detalle del producto">
        <span class="product-dialog-eyebrow">FICHA DEL ARTÍCULO</span>
        <h3>{{ detalle.nombre }}</h3>
        <p>{{ detalle.descripcion || 'Sin descripción' }}</p>
        <dl class="inventory-details">
          <div><dt>ID interno</dt><dd>{{ detalle.id }}</dd></div>
          <div><dt>Precio</dt><dd>S/ {{ detalle.precio | number:'1.2-2' }}</dd></div>
          <div><dt>Stock</dt><dd>{{ detalle.stock }}</dd></div>
          <div><dt>Estado</dt><dd>{{ detalle.stock <= 5 ? 'Stock bajo' : 'Disponible' }}</dd></div>
        </dl>
        <p class="inventory-hint">El ID interno no sustituye el código comercial único pendiente del backend.</p>
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
        <p class="inventory-hint">El backend actual no permite registrar motivo ni consultar historial de ajustes. Esta operación solo modifica existencias.</p>
        <div *ngIf="errorAjuste" role="alert" class="product-form-error">{{ errorAjuste }}</div>
        <div class="actions"><button type="button" class="secondary" (click)="ajusteProducto=null" [disabled]="procesandoAjuste">Cancelar</button><button type="submit" [disabled]="procesandoAjuste">{{ procesandoAjuste ? 'Aplicando...' : 'Confirmar ajuste' }}</button></div>
      </form>
    </div>
    <div class="modal product-modal" *ngIf="productoEliminar" role="presentation">
      <section class="dialog inventory-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
        <span class="product-dialog-eyebrow">CONFIRMAR ACCIÓN</span><h3 id="delete-title">¿Eliminar artículo?</h3>
        <p>Eliminarás <strong>{{ productoEliminar.nombre }}</strong>. Esta acción no se puede deshacer.</p>
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
          <button type="submit" [disabled]="procesando">{{ procesando ? 'Guardando...' : (form.id ? 'Guardar cambios' : 'Registrar artículo') }}</button>
        </div>
      </form>
    </div>
  `
})
export class ProductosComponent implements OnInit {
  readonly auth=inject(AuthService);
  private readonly api = inject(ApiService);
  lista: Producto[] = [];
  q = '';
  filtroStock: 'todos' | 'bajo' | 'agotado' | 'disponible' = 'todos';
  detalle: Producto | null = null;
  ajusteProducto: Producto | null = null;
  productoEliminar: Producto | null = null;
  cantidadAjuste = 1;
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
    const texto = this.q.toLowerCase().trim();
    return this.lista.filter(p => {
      const coincideTexto = `${p.id ?? ''} ${p.nombre} ${p.descripcion || ''}`.toLowerCase().includes(texto);
      const coincideStock = this.filtroStock === 'todos'
        || (this.filtroStock === 'bajo' && p.stock >= 1 && p.stock <= 5)
        || (this.filtroStock === 'agotado' && p.stock === 0)
        || (this.filtroStock === 'disponible' && p.stock > 5);
      return coincideTexto && coincideStock;
    });
  }

  ngOnInit(): void { this.cargar(); }

  get stockEstimado(): number {
    if (!this.ajusteProducto) return 0;
    return this.ajusteProducto.stock + (this.tipoAjuste === 'reponer' ? 1 : -1) * (Number(this.cantidadAjuste) || 0);
  }

  verDetalle(p: Producto): void { this.detalle = p; }

  abrirAjuste(p: Producto): void {
    this.ajusteProducto = p;
    this.cantidadAjuste = 1;
    this.tipoAjuste = 'reponer';
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
    this.procesandoAjuste = true;
    this.api.ajustarStock(p.id, this.tipoAjuste, cantidad).subscribe({
      next: () => {
        this.procesandoAjuste = false;
        this.ajusteProducto = null;
        this.mostrarMensaje('Stock actualizado correctamente.');
        this.cargar();
      },
      error: e => { this.procesandoAjuste = false; this.errorAjuste = this.extraerMensaje(e, 'No se pudo actualizar el stock.'); }
    });
  }

  solicitarEliminar(p: Producto): void { this.productoEliminar = p; }

  confirmarEliminar(): void {
    const p = this.productoEliminar;
    if (!p?.id || this.procesandoEliminar) return;
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
      error: e => { this.procesandoEliminar = false; this.productoEliminar = null; this.mostrarError(e, 'No se pudo eliminar el producto.'); }
    });
  }

  exportarVista(): void {
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(this.filtrados.map(p => ({ ID: p.id, Producto: p.nombre, Descripcion: p.descripcion, Precio: p.precio, Stock: p.stock, Estado: p.activo === false ? 'INACTIVO' : 'ACTIVO' }))), 'Inventario');
    XLSX.writeFile(libro, 'inventario-mostrado.xlsx');
  }
  descargarPlantilla(): void {
    const hoja = XLSX.utils.json_to_sheet([
      { Nombre: 'Ejemplo cuaderno', Descripcion: 'Cuaderno de prueba', Precio: 4.5, Stock: 10, Activo: 'SI' },
      { Nombre: 'Ejemplo lápiz', Descripcion: 'Lápiz de prueba', Precio: 1.5, Stock: 12, Activo: 'SI' }
    ]);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Articulos');
    XLSX.writeFile(libro, 'Plantilla_Maranatha_Articulos.xlsx');
  }

  cargar(): void {
    this.api.productos().subscribe({
      next: productos => this.lista = productos,
      error: error => this.mostrarError(error, 'No se pudieron cargar los productos.')
    });
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


  async importarExcel(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    this.importando = true;
    if (!/\.(xlsx|xls)$/i.test(archivo.name)) {
      this.importando = false;
      this.mostrarErrorSimple('Seleccione un archivo Excel (.xlsx o .xls).');
      return;
    }

    try {
      const contenido = await this.leerArchivo(archivo);
      const filas = this.extraerFilasExcel(contenido);
      if (!filas.length) {
        this.mostrarErrorSimple('El archivo no contiene filas válidas.');
        return;
      }
      await this.procesarImportacion(filas);
    } catch (error) {
      console.error(error);
      this.mostrarErrorSimple('No se pudo leer el archivo Excel.');
    } finally { this.importando = false; }
  }

  private leerArchivo(archivo: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(archivo);
    });
  }

  private extraerFilasExcel(data: ArrayBuffer): any[] {
    const libro = XLSX.read(data, { type: 'array' });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    return hoja ? XLSX.utils.sheet_to_json<any>(hoja, { defval: null }) : [];
  }

  private async procesarImportacion(filas: any[]): Promise<void> {
    const existentesPorId = new Map<number, Producto>(this.lista.filter(p => p.id).map(p => [p.id!, p]));
    const existentesPorNombre = new Map<string, Producto>(this.lista.map(p => [p.nombre.trim().toLowerCase(), p]));
    const resultados: Promise<void>[] = [];
    const resumen = { nuevos: 0, actualizados: 0, omitidos: 0, errores: 0 };

    for (const fila of filas) {
      const productoImportado = this.productoDesdeFila(fila);
      if (!productoImportado
          || !productoImportado.nombre.trim()
          || !productoImportado.descripcion?.trim()
          || productoImportado.precio == null
          || !Number.isFinite(Number(productoImportado.precio))
          || Number(productoImportado.precio) <= 0
          || productoImportado.stock == null
          || !Number.isInteger(Number(productoImportado.stock))
          || Number(productoImportado.stock) < 0) {
        resumen.omitidos++;
        continue;
      }

      const claveNombre = productoImportado.nombre.trim().toLowerCase();
      const existente = productoImportado.id ? existentesPorId.get(productoImportado.id) : existentesPorNombre.get(claveNombre);
      if (existente) {
        const actualizado: Producto = {
          ...existente,
          ...productoImportado,
          id: existente.id,
          precio: productoImportado.precio ?? existente.precio,
          stock: productoImportado.stock ?? existente.stock,
          activo: productoImportado.activo ?? existente.activo
        };
        resultados.push(lastValueFrom(this.api.actualizarProducto(actualizado)).then(() => { resumen.actualizados++; }).catch(error => { console.error(error); resumen.errores++; }));
      } else {
        const nuevo: Producto = {
          nombre: productoImportado.nombre,
          descripcion: productoImportado.descripcion,
          precio: productoImportado.precio ?? 0,
          stock: productoImportado.stock ?? 0,
          activo: productoImportado.activo ?? true
        };
        resultados.push(lastValueFrom(this.api.crearProducto(nuevo)).then(() => { resumen.nuevos++; }).catch(error => { console.error(error); resumen.errores++; }));
      }
    }

    if (!resultados.length) {
      this.mostrarErrorSimple(`Importación revisada: 0 nuevos, 0 actualizados, ${resumen.omitidos} omitidos, 0 con error. No se encontraron filas válidas.`);
      return;
    }

    await Promise.all(resultados);
    const texto = `Importación completada: ${resumen.nuevos} nuevos, ${resumen.actualizados} actualizados, ${resumen.omitidos} omitidos, ${resumen.errores} con error.`;
    if (resumen.errores) this.mostrarErrorSimple(texto);
    else this.mostrarMensaje(texto);
    this.cargar();
  }

  private productoDesdeFila(fila: any): Partial<Producto> & { nombre: string } | null {
    const nombre = this.obtenerCampo(fila, ['Nombre', 'Producto', 'producto', 'product', 'Product']);
    if (!nombre) return null;

    return {
      id: this.parseNumber(this.obtenerCampo(fila, ['ID', 'Id', 'id'])),
      nombre: String(nombre).trim(),
      descripcion: this.obtenerCampo(fila, ['Descripción', 'Descripcion', 'descripcion', 'Desc', 'desc'])?.toString().trim() || undefined,
      precio: this.parseNumber(this.obtenerCampo(fila, ['Precio', 'precio', 'Price', 'price'])),
      stock: this.parseNumber(this.obtenerCampo(fila, ['Stock', 'stock', 'Cantidad', 'cantidad', 'Qty', 'qty'])),
      activo: this.parseBoolean(this.obtenerCampo(fila, ['Activo', 'activo', 'Estado', 'estado', 'Enabled', 'enabled']))
    };
  }

  private obtenerCampo(fila: any, nombres: string[]): any {
    for (const nombre of nombres) {
      if (fila[nombre] != null && fila[nombre] !== '') return fila[nombre];
    }
    const key = Object.keys(fila).find(k => nombres.some(nombre => nombre.toLowerCase() === k.toLowerCase()));
    return key ? fila[key] : null;
  }

  private parseNumber(valor: any): number | undefined {
    if (valor == null || valor === '') return undefined;
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : undefined;
    const texto = String(valor).replace(/[^0-9\-.,]/g, '').replace(',', '.');
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : undefined;
  }

  private parseBoolean(valor: any): boolean | undefined {
    if (valor == null || valor === '') return undefined;
    if (typeof valor === 'boolean') return valor;
    const texto = String(valor).trim().toLowerCase();
    if (['si', 'sí', 'yes', 'true', '1', 'activo', 'enabled'].includes(texto)) return true;
    if (['no', 'false', '0', 'inactivo', 'disabled'].includes(texto)) return false;
    return undefined;
  }

  trackById(_: number, item: Producto): number | undefined { return item.id; }

  private vacio(): Producto { return { nombre: '', descripcion: '', precio: 0, stock: 0, activo: true }; }
  private mostrarMensaje(mensaje: string): void {
    this.mensaje = mensaje; this.esError = false; this.programarLimpiarMensaje();
  }
  private mostrarErrorSimple(mensaje: string): void {
    this.mensaje = mensaje; this.esError = true; this.programarLimpiarMensaje();
  }
  private programarLimpiarMensaje(): void {
    if (this.mensajeTimer) clearTimeout(this.mensajeTimer);
    this.mensajeTimer = setTimeout(() => this.mensaje = '', 5500);
  }
  private mostrarError(error: HttpErrorResponse, fallback: string): void {
    this.mensaje = this.extraerMensaje(error, fallback); this.esError = true; this.programarLimpiarMensaje();
  }
  private extraerMensaje(error: HttpErrorResponse, fallback: string): string {
    return (error.error as ApiError)?.message || (error.status === 0 ? 'No hay conexión con el backend.' : fallback);
  }
}
