import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';
import { ApiService } from '../core/api.service';
import { ApiError, Producto } from '../models';

@Component({
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="page-title">
      <div><h2>Productos e inventario</h2><p>Control de precios y stock en PostgreSQL</p></div>
      <button (click)="nuevo()">+ Nuevo producto</button>
    </div>
    <div *ngIf="mensaje" class="notice" [class.error-notice]="esError">{{ mensaje }}</div>
    <div class="toolbar" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <input placeholder="Buscar producto..." [(ngModel)]="q">
      <button class="secondary" type="button" (click)="archivoImportar.click()">Importar Excel</button>
      <input #archivoImportar type="file" accept=".xlsx,.xls" hidden (change)="importarExcel($event)">
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Producto</th><th>Descripción</th><th>Precio</th><th>IGV</th><th>Stock</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let p of filtrados; trackBy: trackById">
            <td><b>{{ p.nombre }}</b></td>
            <td>{{ p.descripcion || '-' }}</td>
            <td>S/ {{ p.precio | number:'1.2-2' }}</td>
            <td>{{ p.afectacionIgv || 'Sin clasificar' }}</td>
            <td>{{ p.stock }}</td>
            <td><span [class.danger]="p.stock <= 5" class="status">{{ p.stock <= 5 ? 'Stock bajo' : 'Disponible' }}</span></td>
            <td><button class="link" (click)="editar(p)">Editar</button><button class="link danger-text" (click)="eliminar(p)">Eliminar</button></td>
          </tr>
          <tr *ngIf="!filtrados.length"><td colspan="7" class="empty">No hay productos registrados.</td></tr>
        </tbody>
      </table>
    </div>

    <div class="modal" *ngIf="abierto">
      <form class="dialog" (ngSubmit)="guardar()">
        <h3>{{ form.id ? 'Editar' : 'Nuevo' }} producto</h3>
        <label>Nombre<input [(ngModel)]="form.nombre" name="nombre" required maxlength="150"></label>
        <label>Descripción<input [(ngModel)]="form.descripcion" name="descripcion" maxlength="500"></label>
        <div class="row">
          <label>Precio<input type="number" min="0" step="0.01" [(ngModel)]="form.precio" name="precio" required></label>
          <label>Stock<input type="number" min="0" step="1" [(ngModel)]="form.stock" name="stock" required></label>
        </div>
        
        <label>
          Tipo de afectación del IGV
          <select
            name="afectacionIgv"
            [(ngModel)]="form.afectacionIgv">

            <option [ngValue]="null">
              Sin clasificar
            </option>

            <option value="GRAVADO">
              Gravado - Código SUNAT 10
            </option>

            <option value="EXONERADO">
              Exonerado - Código SUNAT 20
            </option>

            <option value="INAFECTO">
              Inafecto - Código SUNAT 30
            </option>

          </select>
        </label>
        <small>
          Selecciona la clasificación tributaria correspondiente al producto.
        </small>

        <small class="error" *ngIf="errorFormulario">{{ errorFormulario }}</small>
        <div class="actions">
          <button type="button" class="secondary" (click)="abierto=false" [disabled]="procesando">Cancelar</button>
          <button [disabled]="procesando">{{ procesando ? 'Guardando...' : 'Guardar' }}</button>
        </div>
      </form>
    </div>
  `
})
export class ProductosComponent implements OnInit {
  private readonly api = inject(ApiService);
  lista: Producto[] = [];
  q = '';
  abierto = false;
  procesando = false;
  mensaje = '';
  esError = false;
  errorFormulario = '';
  form: Producto = this.vacio();
  productoOriginal: Producto | null = null;

  get filtrados(): Producto[] {
    const texto = this.q.toLowerCase().trim();
    return this.lista.filter(p => `${p.nombre} ${p.descripcion || ''}`.toLowerCase().includes(texto));
  }

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.api.productos().subscribe({
      next: productos => this.lista = productos,
      error: error => this.mostrarError(error, 'No se pudieron cargar los productos.')
    });
  }

  nuevo(): void {
    this.form = this.vacio();
    this.productoOriginal = null;
    this.errorFormulario = '';
    this.abierto = true;
  }

  editar(producto: Producto): void {
    this.productoOriginal = { ...producto };
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

    if (
      this.form.precio == null ||
      this.form.precio < 0 ||
      this.form.stock == null ||
      this.form.stock < 0
    ) {
      this.errorFormulario =
        'Precio y stock deben ser valores válidos no negativos.';
      return;
    }

    const original = this.productoOriginal;

    const cambioIgv =
      !!original &&
      this.form.afectacionIgv !== original.afectacionIgv;

    const cambioDatosGenerales =
      !!original &&
      (
        this.form.nombre !== original.nombre ||
        this.form.descripcion !== original.descripcion ||
        this.form.precio !== original.precio ||
        this.form.stock !== original.stock ||
        this.form.activo !== original.activo
      );

    // Si únicamente cambió el IGV, usar PATCH.
    if (original && cambioIgv && !cambioDatosGenerales) {
      if (!original.id || !this.form.afectacionIgv) {
        this.errorFormulario =
          'Seleccione una clasificación tributaria válida.';
        return;
      }

      this.procesando = true;

      this.api.actualizarAfectacionIgv(
        original.id,
        this.form.afectacionIgv
      ).subscribe({
        next: () => {
          this.procesando = false;
          this.abierto = false;
          this.productoOriginal = null;
          this.mostrarMensaje(
            'Clasificación IGV actualizada correctamente.'
          );
          this.cargar();
        },
        error: error => {
          this.procesando = false;
          this.errorFormulario = this.extraerMensaje(
            error,
            'No se pudo actualizar la clasificación IGV.'
          );
        }
      });

      return;
    }

    // Evitar guardar un formulario sin cambios.
    if (original && !cambioIgv && !cambioDatosGenerales) {
      this.abierto = false;
      this.mostrarMensaje('No se realizaron cambios.');
      return;
    }

    // Si se modificaron otros datos, mantener el flujo actual.
    this.procesando = true;

    const operacion = this.form.id
      ? this.api.actualizarProducto(this.form)
      : this.api.crearProducto(this.form);

    operacion.subscribe({
      next: () => {
        this.procesando = false;
        this.abierto = false;
        this.productoOriginal = null;
        this.mostrarMensaje('Producto guardado correctamente.');
        this.cargar();
      },
      error: error => {
        this.procesando = false;
        this.errorFormulario = this.extraerMensaje(
          error,
          'No se pudo guardar el producto.'
        );
      }
    });
  }

  eliminar(producto: Producto): void {
    if (!producto.id || !confirm(`¿Eliminar ${producto.nombre}?`)) return;
    this.api.eliminarProducto(producto.id).subscribe({
      next: () => { this.mostrarMensaje('Producto eliminado.'); this.cargar(); },
      error: error => this.mostrarError(error, 'No se pudo eliminar el producto.')
    });
  }

  async importarExcel(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    if (!/\.(xlsx|xls)$/i.test(archivo.name)) {
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
    }
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
      if (!productoImportado) {
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
      this.mostrarErrorSimple('No se encontraron productos válidos para importar.');
      return;
    }

    await Promise.all(resultados);
    this.mostrarMensaje(`Importación completada: ${resumen.nuevos} nuevos, ${resumen.actualizados} actualizados${resumen.errores ? `, ${resumen.errores} con error` : ''}.`);
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
  private mostrarMensaje(mensaje: string): void { this.mensaje = mensaje; this.esError = false; }
  private mostrarErrorSimple(mensaje: string): void { this.mensaje = mensaje; this.esError = true; }
  private mostrarError(error: HttpErrorResponse, fallback: string): void {
    this.mensaje = this.extraerMensaje(error, fallback); this.esError = true;
  }
  private extraerMensaje(error: HttpErrorResponse, fallback: string): string {
    return (error.error as ApiError)?.message || (error.status === 0 ? 'No hay conexión con el backend.' : fallback);
  }
}
