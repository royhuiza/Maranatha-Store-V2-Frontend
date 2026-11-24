import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { catchError, EMPTY, Subject, switchMap, timer } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { AjusteInventario, ApiError, EstadoStock, Producto } from '../../models';

@Component({
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, CommonModule],
  styleUrls: ['./producto.css'], templateUrl: './producto.html'
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
  productoOriginal: Producto | null = null;
  /** Catálogo completo (sin filtro de búsqueda) para detectar nombres repetidos al registrar. */
  private catalogoCompleto: Producto[] = [];
  private nombreOriginal = '';

  /** T06: artículo que ya usa el nombre escrito (ignora mayúsculas y espacios extra). */
  get duplicado(): Producto | undefined {
    const clave = this.claveNombre(this.form.nombre);
    if (!clave || (this.form.id && clave === this.claveNombre(this.nombreOriginal))) return undefined;
    return this.catalogoCompleto.find(p => p.id !== this.form.id && this.claveNombre(p.nombre) === clave);
  }

  get sugerenciasNombre(): string[] {
    const nombre = (this.form.nombre ?? '').trim().replace(/\s+/g, ' ');
    const descripcion = (this.form.descripcion ?? '').trim();
    const candidatos: string[] = [];
    if (descripcion && !this.claveNombre(nombre).includes(this.claveNombre(descripcion))) {
      candidatos.push(`${nombre} ${descripcion}`);
    }
    const numero = nombre.match(/^(.*?)(\d+)$/);
    for (let i = 1; candidatos.length < 3 && i < 50; i++) {
      candidatos.push(numero
        ? numero[1] + String(Number(numero[2]) + i).padStart(numero[2].length, '0')
        : `${nombre} ${i + 1}`);
    }
    const usados = new Set(this.catalogoCompleto.map(p => this.claveNombre(p.nombre)));
    return candidatos.map(c => c.slice(0, 150)).filter(c => !usados.has(this.claveNombre(c))).slice(0, 3);
  }

  usarNombre(nombre: string): void {
    this.form.nombre = nombre;
    this.limpiarError();
  }

  private claveNombre(nombre?: string | null): string {
    return (nombre ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private cargarCatalogoCompleto(): void {
    this.api.productos('').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: productos => this.catalogoCompleto = productos,
      error: () => this.catalogoCompleto = []
    });
  }

  get filtrados(): Producto[] {
    if (this.cargandoCatalogo || this.errorCatalogo) return [];
    return this.lista.filter(p => this.filtroStock === 'todos'
      || (this.filtroStock === 'bajo' && this.estado(p) === 'STOCK_BAJO')
      || (this.filtroStock === 'agotado' && this.estado(p) === 'SIN_STOCK')
      || (this.filtroStock === 'disponible' && this.estado(p) === 'DISPONIBLE'));
  }

  get mensajeSinResultados(): string {
    const busqueda = this.q.trim();
    if (/^\d+$/.test(busqueda) && !this.lista.length) {
      return `No se encontró un producto con el ID ${busqueda}.`;
    }
    return 'No encontramos artículos con estos filtros. Prueba otro nombre, ID o estado.';
  }

  /** T41: usa el estado que calcula el backend (stock vs. stock mínimo). */
  estado(p: Producto): EstadoStock {
    if (p.estadoStock) return p.estadoStock;
    if (p.stock <= 0) return 'SIN_STOCK';
    return p.stock <= 10 ? 'STOCK_BAJO' : 'DISPONIBLE';
  }

  textoEstado(p: Producto): string {
    return { SIN_STOCK: 'Sin stock', STOCK_BAJO: 'Stock bajo', DISPONIBLE: 'Disponible' }[this.estado(p)];
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

  reactivar(p: Producto): void {
    if (!p.id || this.procesandoEliminar) return;
    this.procesandoEliminar = true;
    this.api.actualizarProducto({ ...p, activo: true }).subscribe({
      next: () => { this.procesandoEliminar = false; this.mostrarMensaje(`${p.nombre} está activo nuevamente.`); this.cargar(); },
      error: e => { this.procesandoEliminar = false; this.errorCatalogo = this.extraerMensaje(e, 'No se pudo reactivar el producto.'); }
    });
  }

  confirmarEliminar(): void {
    const p = this.productoEliminar;
    if (!p?.id || this.procesandoEliminar) return;
    this.errorEliminar = '';
    this.procesandoEliminar = true;
    this.api.eliminarProducto(p.id).subscribe({
      next: () => {
        this.productoEliminar = null;
        this.procesandoEliminar = false;
        this.mostrarMensaje(`${p.nombre} pasó a inactivo. Sigue en el catálogo, pero no se puede vender.`);
        this.cargar();
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
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(this.filtrados.map(p => ({ Codigo: p.codigo, Producto: p.nombre, Descripcion: p.descripcion, Precio: p.precio, Stock: p.stock, StockMinimo: p.stockMinimo ?? 5, Estado: p.activo === false ? 'INACTIVO' : 'ACTIVO' }))), 'Inventario');
    XLSX.writeFile(libro, 'inventario-mostrado.xlsx');
  }
  async descargarPlantilla(): Promise<void> {
    const XLSX = await import('xlsx');
    const hoja = XLSX.utils.json_to_sheet([
      { Nombre: 'Ejemplo cuaderno', Descripcion: 'Cuaderno de prueba', Precio: 4.5, 'Cantidad ingresada': 10, Activo: 'SI' },
      { Nombre: 'Ejemplo lápiz', Descripcion: 'Lápiz de prueba', Precio: 1.5, 'Cantidad ingresada': 12, Activo: 'SI' }
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

  esStockMinimoValido(): boolean {
    const v = this.form.stockMinimo;
    return v != null && Number.isInteger(Number(v)) && Number(v) >= 0;
  }

  esStockValido(): boolean {
    return this.form.stock != null && Number.isInteger(Number(this.form.stock)) && Number(this.form.stock) >= 0;
  }

  nuevo(): void {
    this.form = this.vacio();
    this.productoOriginal = null;
    this.nombreOriginal = '';
    this.errorFormulario = '';
    this.abierto = true;
    this.cargarCatalogoCompleto();
  }

  editar(producto: Producto): void {
    this.productoOriginal = { ...producto };
    this.form = { ...producto, afectacionIgv: producto.afectacionIgv ?? null };
    this.nombreOriginal = producto.nombre;
    this.errorFormulario = '';
    this.abierto = true;
    this.cargarCatalogoCompleto();
  }

  esAfectacionIgvValida(): boolean {
    return this.form.afectacionIgv === 'GRAVADO' ||
      this.form.afectacionIgv === 'EXONERADO' ||
      this.form.afectacionIgv === 'INAFECTO';
  }

  guardar(): void {
    if (this.procesando) return;
    this.errorFormulario = '';

    if (!this.esAfectacionIgvValida()) {
      this.errorFormulario = 'Seleccione el tipo de afectación del IGV.';
      return;
    }

    if (!this.form.nombre.trim()) {
      this.errorFormulario = 'Ingrese el nombre del producto.';
      return;
    }
    if (this.duplicado) {
      this.errorFormulario = 'Ese nombre ya está registrado. Elige otro nombre.';
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

    if (!this.form.id && !this.esStockValido()) {
      this.errorFormulario = 'El stock debe ser un número entero no negativo.';
      return;
    }

    this.form.nombre = this.form.nombre.trim().replace(/\s+/g, ' ');
    this.form.descripcion = this.form.descripcion.trim();
    const original = this.productoOriginal;

    const cambioIgv =
      !!original &&
      (this.form.afectacionIgv ?? null) !== (original.afectacionIgv ?? null);

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

    if (!window.confirm('Las cantidades del Excel se SUMARÁN al stock existente. ¿Continuar?')) { this.formImportacion.reset(); return; }
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

  private vacio(): Producto { return { nombre: '', descripcion: '', precio: 0, stock: 0, stockMinimo: 10, activo: true, afectacionIgv: null }; }
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
