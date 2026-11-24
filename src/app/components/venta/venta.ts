import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { ApiError, Cliente, DetalleVenta, Producto, TipoComprobante, Venta } from '../../models';
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrls: ['./venta.css'], templateUrl: './venta.html',
})
export class VentasComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private claveVentaActual?: string;
  requiereRevision = false;
  productos: Producto[] = [];
  clientes: Cliente[] = [];
  ventas: Venta[] = [];
  // Controla la vista de Ventas y Facturación
  mostrarFormularioVenta = false;
  pasoVenta: 'cliente' | 'carrito' | 'pago' = 'cliente';
  readonly metodosPago = ['EFECTIVO', 'YAPE', 'PLIN'] as const;
  metodoPago: typeof this.metodosPago[number] = 'EFECTIVO';
  eventosYape: Array<{ id: string; monto: number; fecha: number }> = [];
  errorYape = '';
  private inicioYape = 0;
  private consultaActiva = false;
  private cicloYape = 0;
  private relojYape?: ReturnType<typeof setInterval>;
  get pagoYape() {
    const candidatos = this.eventosYape.filter(e =>
      e.fecha >= this.inicioYape && e.fecha <= Date.now() + 300000 &&
      e.fecha >= Date.now() - 600000 &&
      Math.round(Number(e.monto) * 100) === Math.round(this.totalBorrador * 100));
    return candidatos.length === 1 && !this.errorYape ? candidatos[0] : undefined;
  }
  get puedeRegistrar(): boolean {
    return !this.procesando && !this.requiereRevision && !!this.detalles.length &&
      this.pasoVenta === 'pago' && (this.metodoPago === 'EFECTIVO' ? this.pagoConfirmado :
        this.metodoPago === 'YAPE' && !!this.pagoYape);
  }
  detenerYape(): void {
    clearInterval(this.relojYape);
    this.cicloYape++;
    this.consultaActiva = false;
    this.eventosYape = [];
    this.errorYape = '';
  }
  ngOnDestroy(): void { this.detenerYape(); }
  consultarYape(): void {
    if (this.consultaActiva || this.procesando || this.metodoPago !== 'YAPE' ||
      this.pasoVenta !== 'pago' || !this.mostrarFormularioVenta) return;
    const ciclo = this.cicloYape;
    this.consultaActiva = true;
    this.api.eventosYape().subscribe({
      next: eventos => {
        if (ciclo !== this.cicloYape) return;
        this.eventosYape = eventos; this.errorYape = ''; this.consultaActiva = false;
      },
      error: () => {
        if (ciclo !== this.cicloYape) return;
        this.eventosYape = []; this.errorYape = 'No se pudo consultar el receptor.'; this.consultaActiva = false;
      }
    });
  }
  pagoConfirmado = false;
  seleccionarMetodoPago(metodo: typeof this.metodosPago[number]): void {
    if (this.procesando || this.metodoPago === metodo) return;
    this.detenerYape();
    this.metodoPago = metodo;
    this.pagoConfirmado = false;
    if (metodo === 'YAPE') {
      if (this.inicioYape === 0) {
        this.inicioYape = Date.now();
      }
      this.consultarYape();
      this.relojYape = setInterval(() => this.consultarYape(), 2000);
    }
  }
  volverAlCarrito(): void { this.detenerYape(); this.pasoVenta = 'carrito'; }
  irAPago(): void {
    if (!this.detalles.length || this.procesando) return;
    this.metodoPago = 'EFECTIVO';
    this.pagoConfirmado = false;
    this.pasoVenta = 'pago';
  }
  mostrarDatosCliente = false;
  // Filtros para el historial de comprobantes
  busquedaComprobante = '';
  filtroTipoComprobante = 'TODOS';
  get ventasFiltradas(): Venta[] {
    const busqueda = this.busquedaComprobante.trim().toLowerCase();
    return this.ventas.filter(venta => {
      const coincideTipo =
        this.filtroTipoComprobante === 'TODOS' ||
        venta.tipoComprobante === this.filtroTipoComprobante;
      const textoBusqueda = [
        venta.serie,
        venta.numero,
        `${venta.serie}-${venta.numero}`,
        venta.clienteNombre,
        this.textoTipo(venta.tipoComprobante)
      ].join(' ').toLowerCase();
      return coincideTipo && textoBusqueda.includes(busqueda);
    });
  }
  get datosComprobanteCompletos(): boolean {
    if (this.tipo === 'NOTA_PEDIDO') return true;
    if (this.documentoBuscando) return false;
    const longitud = this.tipo === 'FACTURA' ? 11 : 8;
    return this.mostrarDatosCliente && new RegExp('^[0-9]{' + longitud + '}$').test(this.documento.trim()) &&
      !!this.documentoNombre.trim() && (this.tipo !== 'BOLETA' || !!this.documentoApellidos.trim()) &&
      (this.tipo !== 'FACTURA' || !!this.documentoDireccion.trim());
  }
  continuarAlCarrito(): void {
    if (!this.datosComprobanteCompletos) {
      this.documentoError = 'Completa el documento y los datos del cliente para continuar.';
      return;
    }
    this.documentoError = '';
    this.pasoVenta = 'carrito';
  }
  tipo: TipoComprobante = 'BOLETA';
  clienteId?: number;
  productoId?: number;
  cantidad = 1;
  documento = '';
  documentoNombre = '';
  documentoApellidos = '';
  documentoDireccion = '';
  documentoError = '';
  private consultaDocumentoId = 0;
  documentoBuscando = false;
  documentoValido = false;
  productoFiltro = '';
  detalles: DetalleVenta[] = [];
  ventaEmitida?: Venta;
  procesando = false;
  mensaje = '';
  esError = false;
  mostrarDialogoImpresion = false;
  preferenciaImpresion?: 'TICKET' | 'A4';
  usarSiempreImpresion = false;
  igvRate = 0.18; // 18% IGV
  preciosIncluyenIgv = true;
  get totalBorrador(): number {
    return this.detalles.reduce((suma, detalle) => suma + (detalle.subtotal || 0), 0);
  }
  get clienteSeleccionado(): string {
    const cliente = this.clientes.find(item => item.id === this.clienteId);
    return cliente ? `${cliente.nombre} ${cliente.apellido || ''}`.trim() : 'Público general';
  }
  get comprobanteDetalles(): DetalleVenta[] {
    return this.ventaEmitida?.detalles || this.detalles;
  }
  get comprobanteTotal(): number {
    return this.ventaEmitida?.total ?? this.totalBorrador;
  }
  get comprobanteCliente(): string {
    return this.ventaEmitida?.clienteNombre || this.documentoNombre.trim() || this.clienteSeleccionado;
  }
  get comprobanteDocumento(): string {
    if (this.ventaEmitida?.clienteDocumento) return this.ventaEmitida.clienteDocumento;
    const cliente = this.clientes.find(item => item.id === this.clienteId);
    if (cliente?.numeroDocumento) return `${cliente.tipoDocumento} ${cliente.numeroDocumento}`;
    if (this.documento) return `${this.tipo === 'BOLETA' ? 'DNI' : 'RUC'} ${this.documento}`;
    return '';
  }
  stockDisponibleCarrito(producto: Producto): number {
    const cantidadEnCarrito = this.detalles
      .filter(item => item.productoId === producto.id)
      .reduce((total, item) => total + item.cantidad, 0);
    return Math.max(0, producto.stock - cantidadEnCarrito);
  }
  get productosFiltrados(): Producto[] {
    const filtro = this.productoFiltro.trim().toLowerCase();
    return this.productos.filter(producto =>
      this.stockDisponibleCarrito(producto) > 0 &&
      producto.nombre.toLowerCase().includes(filtro)
    );
  }
  get productoSeleccionadoNombre(): string {
    const producto = this.productos.find(p => p.id === this.productoId);
    return producto ? producto.nombre : 'Ninguno';
  }
  get comprobanteFecha(): Date | string {
    return this.ventaEmitida?.fecha || new Date();
  }
  get comprobanteTipo(): string {
    return this.textoTipo(this.ventaEmitida?.tipoComprobante || this.tipo);
  }
  private get resumenFiscal() {
    const d = this.ventaEmitida?.detalles;
    if (!d?.length || this.ventaEmitida?.tipoComprobante === 'NOTA_PEDIDO') return undefined;
    let gravado = 0, exonerado = 0, inafecto = 0, igv = 0;
    for (const item of d) {
      const tipo = (item as DetalleVenta & { afectacionIgv?: string }).afectacionIgv;
      if (item.subtotal == null || !Number.isFinite(item.subtotal)) return undefined;
      const cents = Math.round(item.subtotal * 100);
      if (tipo === 'GRAVADO') { const base = Math.round(cents / 1.18); gravado += base; igv += cents - base; }
      else if (tipo === 'EXONERADO') exonerado += cents;
      else if (tipo === 'INAFECTO') inafecto += cents;
      else return undefined;
    }
    if (gravado + exonerado + inafecto + igv !== Math.round(this.comprobanteTotal * 100)) return undefined;
    return { gravado: gravado / 100, exonerado: exonerado / 100, inafecto: inafecto / 100, igv: igv / 100 };
  }
  get comprobanteBase(): number | null { return this.resumenFiscal?.gravado ?? null; }
  get comprobanteIgv(): number | null { return this.resumenFiscal?.igv ?? null; }
  get comprobanteExonerado(): number | null { return this.resumenFiscal?.exonerado ?? null; }
  get comprobanteInafecto(): number | null { return this.resumenFiscal?.inafecto ?? null; }
  get comprobanteTotalConIgv(): number { return this.comprobanteTotal; }
  estadoFiscal(v?: Venta): string {
    if (v?.tipoComprobante === 'NOTA_PEDIDO') return 'No aplica';
    const estado = (v as (Venta & { estadoSunat?: string }) | undefined)?.estadoSunat;
    const etiquetas: Record<string, string> = { "NO_APLICA": "No aplica", "PENDIENTE": "Pendiente", "EN_PROCESO": "En proceso", "ACEPTADO_BETA": "Aceptado en Beta", "OBSERVADO_BETA": "Observado en Beta", "RECHAZADO_BETA": "Rechazado en Beta", "ERROR_COMUNICACION": "Error de comunicación", "REQUIERE_REVISION": "Requiere revisión", "ACEPTADO": "Aceptado registrado (sin confirmación)", "OBSERVADO": "Observado registrado", "RECHAZADO": "Rechazado registrado" };
    return etiquetas[estado ?? ''] ?? 'Sin registro fiscal';
  }

  ngOnInit(): void {
    this.cargarCatalogos();
    this.cargarVentas();
    const pref = localStorage.getItem('maranatha.imprimir.formato');
    if (pref === 'TICKET' || pref === 'A4') this.preferenciaImpresion = pref as 'TICKET' | 'A4';
  }
  cambiarTipo(tipo: TipoComprobante): void { this.tipo = tipo; this.onTipoChange(); }

  onTipoChange(): void {
    this.consultaDocumentoId++;
    this.documentoBuscando = false;
    this.mostrarDatosCliente = false;
    this.ventaEmitida = undefined;
    this.documento = '';
    this.documentoNombre = ''; this.documentoApellidos = '';
    this.documentoError = '';
    this.documentoValido = false;
    this.documentoDireccion = '';
  }
  onDocumentoChange(): void {
    this.consultaDocumentoId++;
    this.documentoBuscando = false;
    this.mostrarDatosCliente = false;
    this.documento = this.documento.replace(/\D/g, '').slice(0, this.tipo === 'FACTURA' ? 11 : 8);
    this.documentoNombre = ''; this.documentoApellidos = '';
    this.documentoError = '';
    this.documentoValido = false;
    this.documentoDireccion = '';
    if (this.tipo !== 'NOTA_PEDIDO' && this.documento.length === (this.tipo === 'FACTURA' ? 11 : 8)) this.buscarDocumento();
  }
  onProductoFiltroChange(): void {
    this.productoId = undefined;
  }
  seleccionarProducto(id?: number): void {
    this.productoId = id;
    this.mensaje = '';
    this.productoFiltro = this.productos.find(p => p.id === id)?.nombre || '';
  }
  buscarDocumento(): void {
    if (this.documentoBuscando || this.tipo === 'NOTA_PEDIDO') return;
    const consultaId = ++this.consultaDocumentoId;
    this.mostrarDatosCliente = true;
    this.documentoError = '';
    this.documentoNombre = ''; this.documentoApellidos = '';
    this.documentoValido = false;
    const numero = this.documento.trim();
    if (this.tipo === 'BOLETA') {
      if (!/^[0-9]{8}$/.test(numero)) {
        this.documentoError = 'El DNI debe tener 8 dígitos válidos.';
        return;
      }
      this.documentoBuscando = true;
      this.api.buscarDni(numero).subscribe({
        next: data => {
          if (consultaId !== this.consultaDocumentoId) return;
          this.documentoBuscando = false;
          this.documentoValido = true;
          this.documentoNombre =
            (data.nombres || '').trim();
          this.documentoApellidos = `${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`.trim();
        },
        error: err => {
          if (consultaId !== this.consultaDocumentoId) return;
          this.documentoBuscando = false;
          const status = err?.status ?? 0;
          this.documentoError = status === 0
            ? 'No se pudo consultar el DNI. Intenta nuevamente.'
            : 'No se encontró el DNI. Verifica el número e intenta nuevamente.';
        }
      });
      return;
    }
    if (this.tipo === 'FACTURA') {
      if (!/^[0-9]{11}$/.test(numero)) {
        this.documentoError = 'El RUC debe tener 11 dígitos válidos.';
        return;
      }
      this.documentoBuscando = true;
      this.api.buscarRuc(numero).subscribe({
        next: data => {
          if (consultaId !== this.consultaDocumentoId) return;
          this.documentoBuscando = false;
          this.documentoValido = true;
          this.documentoNombre = data.razonSocial?.trim() || '';
          this.documentoDireccion = data.direccionFiscal?.trim() || '';
        },
        error: err => {
          if (consultaId !== this.consultaDocumentoId) return;
          this.documentoBuscando = false;
          this.documentoValido = false;
          const status = err?.status ?? 0;
          if (status === 503) {
            this.documentoError =
              'La consulta RUC oficial todavía no está habilitada. ' +
              'Ingrese la razón social y dirección fiscal manualmente.';
          } else if (status === 401) {
            this.documentoError =
              'No se pudo autorizar la consulta RUC. Complete los datos manualmente mientras se corrige el servicio.';
          } else if (status === 404) {
            this.documentoError =
              'No se encontró el servicio de consulta RUC.';
          } else {
            this.documentoError =
              'No fue posible consultar el RUC. Intente nuevamente.';
          }
        }
      });
      return;
    }
  }
  cargarCatalogos(): void {
    this.api.productos().subscribe({
      next: (productos) => {
        this.productos = productos.filter(item => item.activo !== false);
        if (!this.productos.some(item => item.id === this.productoId)) {
          this.productoId = this.productos.find(item => item.stock > 0)?.id;
        }
      },
      error: error => this.mostrarError(error, 'No se pudieron cargar productos.')
    });
  }
  cargarVentas(): void {
    this.api.ventas().subscribe({
      next: ventas => this.ventas = ventas,
      error: error => this.mostrarError(error, 'No se pudo cargar el historial de ventas.')
    });
  }
  agregar(): void {
    this.ventaEmitida = undefined;
    const producto = this.productos.find(item => item.id === this.productoId);
    const cantidad = Number(this.cantidad);
    if (!producto || !Number.isInteger(cantidad) || cantidad < 1) {
      this.mostrarErrorSimple('Seleccione un producto e ingrese una cantidad válida.');
      return;
    }
    const existente = this.detalles.find(item => item.productoId === producto.id);
    const cantidadTotal = cantidad + (existente?.cantidad || 0);
    if (cantidadTotal > producto.stock) {
      this.mostrarErrorSimple(`Stock insuficiente. Solo quedan ${this.stockDisponibleCarrito(producto)} unidades disponibles para agregar.`);
      return;
    }
    if (existente) {
      existente.cantidad = cantidadTotal;
      existente.subtotal = cantidadTotal * (existente.precioUnitario || 0);
    } else {
      this.detalles.push({
        productoId: producto.id!,
        productoNombre: producto.nombre,
        cantidad,
        precioUnitario: producto.precio,
        subtotal: producto.precio * cantidad
      });
    }
    this.cantidad = 1;
    this.productoId = undefined;
    this.productoFiltro = '';
    this.mensaje = '';
  }
  quitar(indice: number): void {
    this.detalles.splice(indice, 1);
    this.ventaEmitida = undefined;
  }
  registrar(): void {
    if (this.procesando || this.requiereRevision || !this.detalles.length) return;
    if (!this.puedeRegistrar) {
      this.mostrarErrorSimple('Confirma el pago antes de registrar la venta.');
      return;
    }
    if (this.metodoPago === 'YAPE') this.claveVentaActual = `YAPE-${this.pagoYape!.id}`;
    this.detenerYape();
    this.procesando = true;
    this.mensaje = '';
    this.claveVentaActual ??= crypto.randomUUID();
    this.api.crearVenta({
      idempotencyKey: this.claveVentaActual,
      documento: this.documento.trim() || undefined,
      compradorNombre: [this.documentoNombre, this.tipo === 'BOLETA' ? this.documentoApellidos : ''].join(' ').trim() || undefined,
      metodoPago: this.metodoPago,
      tipoComprobante: this.tipo,
      detalles: this.detalles.map(item => ({ productoId: item.productoId, cantidad: item.cantidad }))
    }, this.claveVentaActual).subscribe({
      next: venta => {
        this.procesando = false;
        this.ventaEmitida = venta;
        this.detalles = [];
        this.mensaje = `Venta registrada: ${venta.serie}-${venta.numero}. El stock fue actualizado.`;
        this.esError = false;
        this.cargarCatalogos();
        this.cargarVentas();
        void this.compartirComprobante(venta, true);
      },
      error: error => {
        this.procesando = false;
        this.requiereRevision = true;
        this.mostrarError(error, 'Registro sin confirmar. Revisa el historial antes de continuar.');
      }
    });
  }
  anular(venta: Venta): void {
    if (!confirm(`¿Anular ${venta.serie}-${venta.numero}? El stock será repuesto.`)) return;
    this.api.anularVenta(venta.id).subscribe({
      next: anulada => {
        this.ventaEmitida = anulada;
        this.mensaje = `Venta ${anulada.serie}-${anulada.numero} anulada y stock repuesto.`;
        this.esError = false;
        this.cargarCatalogos();
        this.cargarVentas();
      },
      error: error => this.mostrarError(error, 'No se pudo anular la venta.')
    });
  }
  verComprobante(venta: Venta): void {
    this.ventaEmitida = venta; this.mostrarFormularioVenta = true; this.pasoVenta = 'carrito';
  }
  reimprimir(venta: Venta): void {
    this.ventaEmitida = venta;
    this.mostrarFormularioVenta = true;
    this.pasoVenta = 'carrito';
    this.mostrarDialogoImpresion = true;
  }
  nuevoComprobante(): void {
    if (this.procesando) return;
    this.detenerYape();
    if (this.requiereRevision) { this.mostrarErrorSimple('Revisa el historial antes de repetir la operacion.'); return; }
    this.claveVentaActual = undefined;
    this.inicioYape = 0;
    this.consultaDocumentoId++;
    this.documentoBuscando = false;
    this.mostrarFormularioVenta = true;
    this.pasoVenta = 'cliente';
    this.metodoPago = 'EFECTIVO';
    this.pagoConfirmado = false;
    this.mostrarDatosCliente = false;
    this.ventaEmitida = undefined;
    this.detalles = [];
    this.tipo = 'BOLETA';
    this.clienteId = undefined;
    this.cantidad = 1;
    this.productoId = undefined;
    this.productoFiltro = '';
    this.documento = '';
    this.documentoNombre = ''; this.documentoApellidos = '';
    this.documentoDireccion = '';
    this.documentoError = '';
    this.documentoValido = false;
    this.mensaje = '';
  }
  cerrarFormularioVenta(): void {
    if (this.procesando) return;
    this.detenerYape();
    this.consultaDocumentoId++;
    this.documentoBuscando = false;
    this.mostrarFormularioVenta = false;
    this.mostrarDialogoImpresion = false;
  }
  abrirDialogoImpresion(): void {
    // Mostrar siempre las opciones: permite elegir Ticket o A4 en cada impresión.
    this.usarSiempreImpresion = false;
    this.mostrarDialogoImpresion = true;
  }

  seleccionarFormato(formato: 'TICKET' | 'A4'): void {
    if (!this.ventaEmitida) {
      this.mostrarErrorSimple('No existe una venta registrada para imprimir.');
      return;
    }

    this.mostrarDialogoImpresion = false;
    if (this.usarSiempreImpresion) {
      localStorage.setItem('maranatha.imprimir.formato', formato);
      this.preferenciaImpresion = formato;
    }

    this.imprimirComprobante(this.ventaEmitida, formato);
  }

  private imprimirComprobante(venta: Venta, formato: 'TICKET' | 'A4'): void {
    // El iframe evita imprimir el menú, el modal y otras partes de Angular.
    // No realiza solicitudes al backend ni modifica stock.
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      iframe.remove();
      this.mostrarErrorSimple('No se pudo preparar la impresión.');
      return;
    }

    const escapeHtml = (valor: unknown): string => String(valor ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const dinero = (valor: unknown): string => {
      const numero = Number(valor ?? 0);
      return `S/ ${Number.isFinite(numero) ? numero.toFixed(2) : '0.00'}`;
    };
    const fecha = venta.fecha
      ? new Date(venta.fecha).toLocaleString('es-PE')
      : 'Fecha no disponible';
    const nombre = escapeHtml(venta.clienteNombre || 'Público general');
    const documento = escapeHtml(venta.clienteDocumento || '');
    const detalles = (venta.detalles || []).map(d => `
      <tr>
        <td>${escapeHtml(d.cantidad)}</td>
        <td>${escapeHtml(d.productoNombre)}</td>
        <td class="number">${dinero(d.precioUnitario)}</td>
        <td class="number">${dinero(d.subtotal)}</td>
      </tr>`).join('');
    const titulo = escapeHtml(this.textoTipo(venta.tipoComprobante));
    const serie = escapeHtml(`${venta.serie}-${venta.numero}`);
    const esTicket = formato === 'TICKET';
    const advertencia = venta.tipoComprobante === 'NOTA_PEDIDO'
      ? 'Nota de pedido. No constituye comprobante de pago tributario.'
      : 'Representación impresa del registro interno. Validación SUNAT pendiente; no acredita aceptación por SUNAT.';

    const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>${titulo} ${serie}</title>
<style>
  @page { size: ${esTicket ? '80mm 297mm' : 'A4'}; margin: ${esTicket ? '0' : '12mm'}; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: ${esTicket ? '4mm' : '6mm'}; color: #111; background: #fff;
         font-family: Arial, Helvetica, sans-serif; font-size: ${esTicket ? '10px' : '12px'}; }
  .sheet { width: ${esTicket ? '72mm' : '100%'}; margin: 0 auto; }
  h1 { font-size: ${esTicket ? '16px' : '23px'}; margin: 0 0 5px; text-align: center; }
  .center { text-align: center; }
  .muted { color: #555; }
  .doc-title { border: 1px solid #222; padding: 8px; margin: 12px 0; text-align: center; font-weight: 700; }
  .meta { line-height: 1.6; overflow-wrap: anywhere; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; table-layout: fixed; }
  th, td { border-bottom: 1px solid #ddd; padding: 6px 3px; vertical-align: top; overflow-wrap: anywhere; }
  th:nth-child(1), td:nth-child(1) { width: 12%; }
  th:nth-child(2), td:nth-child(2) { width: 40%; }
  th:nth-child(3), td:nth-child(3) { width: 24%; }
  th:nth-child(4), td:nth-child(4) { width: 24%; }
  .number { text-align: right; }
  .total { border-top: 2px solid #111; padding: 9px 0; display: flex;
           justify-content: space-between; font-size: ${esTicket ? '13px' : '17px'}; font-weight: bold; }
  .footer { border-top: 1px dashed #777; padding-top: 10px; margin-top: 16px;
            font-size: ${esTicket ? '9px' : '11px'}; line-height: 1.4; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr { break-inside: avoid; } }
</style></head><body><main class="sheet">
<h1>MARANATHA STORE</h1>
<div class="center muted">Librería escolar</div>
<div class="center muted">Datos fiscales del emisor pendientes de configuración</div>
<div class="doc-title">${titulo}<div>${serie}</div></div>
<div class="meta"><strong>Fecha:</strong> ${escapeHtml(fecha)}<br>
<strong>Cliente:</strong> ${nombre}<br>
${documento ? `<strong>Documento:</strong> ${documento}<br>` : ''}
<strong>Estado interno:</strong> ${escapeHtml(venta.estado || 'Sin información')}</div>
<table><thead><tr><th>Cant.</th><th>Descripción</th><th class="number">P. unit.</th><th class="number">Importe</th></tr></thead>
<tbody>${detalles || '<tr><td colspan="4">Sin detalle disponible</td></tr>'}</tbody></table>
<div class="total"><span>TOTAL</span><span>${dinero(venta.total)}</span></div>
<div class="center">Gracias por su compra</div>
<div class="footer">${escapeHtml(advertencia)}<br>
Los importes tributarios detallados se mostrarán cuando estén calculados y persistidos por el backend.</div>
</main></body></html>`;

    doc.open();
    doc.write(html);
    doc.close();

    let terminado = false;
    const limpiar = () => {
      if (terminado) return;
      terminado = true;
      win.removeEventListener('afterprint', limpiar);
      setTimeout(() => iframe.remove(), 300);
    };
    win.addEventListener('afterprint', limpiar);
    setTimeout(() => {
      try { win.focus(); win.print(); }
      catch (error) {
        console.error('Error al imprimir:', error);
        this.mostrarErrorSimple('El navegador no pudo abrir la impresión.');
        limpiar();
      }
    }, 250);
  }

  private async capturarComprobante(formato: 'TICKET' | 'A4' = 'A4'): Promise<HTMLCanvasElement> {
    const selector = formato === 'A4' ? '#comprobante .comprobante-a4' : '#comprobante .comprobante-ticket';
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) throw new Error('Comprobante no disponible');
    await document.fonts.ready;
    await Promise.all(Array.from(el.querySelectorAll('img')).map(img => img.decode().catch(() => undefined)));
    const { default: html2canvas } = await import('html2canvas');
    return html2canvas(el, {
      scale: 2, backgroundColor: '#fff', useCORS: true, onclone: (doc: Document) => {
        const copia = doc.querySelector<HTMLElement>(selector);
        if (copia) { copia.style.display = 'block'; copia.style.transform = 'none'; copia.style.backgroundColor = '#fff'; copia.style.color = '#111'; if (formato === 'TICKET') copia.style.width = '52mm'; }
        const panel = doc.querySelector<HTMLElement>('#comprobante');
        if (panel) { panel.style.backgroundColor = '#fff'; panel.style.color = '#111'; }
      }
    });
  }
  private async crearPdfComprobante(venta: Venta): Promise<File> {
    const canvas = await this.capturarComprobante();
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const ratio = Math.min(190 / canvas.width, 277 / canvas.height);
    const w = canvas.width * ratio, h = canvas.height * ratio;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (210 - w) / 2, 10, w, h);
    return new File([pdf.output('blob')], `comprobante-${venta.serie}-${venta.numero}.pdf`, { type: 'application/pdf' });
  }
  envioVenta?: Venta;
  envioArchivo?: File;
  envioCanal: 'whatsapp' | 'correo' | 'enlace' | '' = '';
  envioEnlace = '';
  envioNumero = '';
  envioPais: CountryCode = 'PE';
  readonly paises = getCountries().map(codigo => ({ codigo, nombre: new Intl.DisplayNames(['es'], { type: 'region' }).of(codigo) || codigo, prefijo: '+' + getCountryCallingCode(codigo), bandera: Array.from(codigo).map(c => String.fromCodePoint(127397 + c.charCodeAt(0))).join('') })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  get envioPrefijo(): string { return '+' + getCountryCallingCode(this.envioPais); }
  seleccionarCanal(canal: 'whatsapp' | 'correo' | 'enlace'): void { this.envioCanal = canal; this.envioEstado = ''; }
  envioCorreo = '';
  envioEstado = '';
  envioOcupado = false;
  ventaRecienRegistrada = false;
  async compartirComprobante(venta: Venta, recienRegistrada = false): Promise<void> {
    this.ventaRecienRegistrada = recienRegistrada;
    this.verComprobante(venta);
    this.envioVenta = venta; this.envioArchivo = undefined; this.envioEstado = 'Preparando PDF…'; this.envioOcupado = true;
    this.envioPais = 'PE'; this.envioNumero = ''; this.envioCorreo = ''; this.envioCanal = ''; this.envioEnlace = '';
    try {
      await new Promise(r => setTimeout(r, 150));
      this.envioArchivo = await this.crearPdfComprobante(venta); this.envioEstado = '';
    } catch (e) { this.envioEstado = 'No se pudo preparar el PDF.'; } finally { this.envioOcupado = false; }
  }
  enviarCorreoComprobante(): void {
    if (!this.envioVenta || !this.envioArchivo || this.envioOcupado) return;
    const correo = this.envioCorreo.trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { this.envioEstado = 'Ingresa un correo válido.'; return; }
    this.envioOcupado = true; this.envioEstado = 'Enviando…';
    this.api.enviarCorreo(this.envioVenta.id, correo, this.envioArchivo).subscribe({ next: () => { this.envioEstado = 'Correo aceptado por el servidor SMTP.'; this.envioOcupado = false; }, error: () => { this.envioEstado = 'No se pudo enviar. Revisa la configuración SMTP o la conexión.'; this.envioOcupado = false; } });
  }
  abrirWhatsAppComprobante(): void {
    if (!this.envioArchivo) return;
    const telefono = parsePhoneNumberFromString(this.envioNumero.trim(), this.envioPais);
    if (!telefono || !telefono.isValid() || telefono.country !== this.envioPais) { this.envioEstado = 'Ingresa un número válido para el país seleccionado.'; return; }
    const numero = telefono.number.slice(1);
    if (!this.envioVenta || this.envioOcupado) return;
    const popup = window.open('about:blank', '_blank');
    if (!popup) { this.envioEstado = 'Permite ventanas emergentes para abrir WhatsApp.'; return; }
    popup.opener = null;
    this.envioOcupado = true;
    this.api.crearEnlaceComprobante(this.envioVenta.id, this.envioArchivo).subscribe({
      next: r => {
        popup.location.href = `https://wa.me/${numero}?text=${encodeURIComponent('Gracias por su compra en Maranatha Store. Descargue su comprobante: ' + r.url)}`;
        this.envioEstado = 'Confirma el envío en WhatsApp.'; this.envioOcupado = false;
      }, error: () => { popup.close(); this.envioEstado = 'No se pudo generar el enlace.'; this.envioOcupado = false; }
    });
  }
  generarEnlaceComprobante(): void {
    this.seleccionarCanal('enlace');
    if (this.envioEnlace) return;
    if (!this.envioVenta || !this.envioArchivo || this.envioOcupado) return;
    this.envioOcupado = true;
    this.api.crearEnlaceComprobante(this.envioVenta.id, this.envioArchivo).subscribe({ next: r => { this.envioEnlace = r.url; this.envioOcupado = false; this.envioEstado = 'Enlace listo. Puedes copiarlo.'; }, error: () => { this.envioOcupado = false; this.envioEstado = 'No se pudo generar el enlace.'; } });
  }
  async copiarEnlaceComprobante(): Promise<void> {
    if (!this.envioEnlace) return;
    try { await navigator.clipboard.writeText(this.envioEnlace); this.envioEstado = 'Enlace copiado.'; }
    catch { this.envioEstado = 'No se pudo copiar automáticamente. Selecciona el enlace y presiona Ctrl+C.'; }
  }
  descargarArchivoEnvio(): void {
    if (!this.envioArchivo) return;
    const url = URL.createObjectURL(this.envioArchivo); const a = document.createElement('a'); a.href = url; a.download = this.envioArchivo.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  imprimirDesdeEnvio(formato: 'TICKET' | 'A4'): void { this.seleccionarFormato(formato); }
  async compartirArchivoMovil(): Promise<void> {
    if (!this.envioArchivo) return;
    if (!navigator.canShare?.({ files: [this.envioArchivo] })) { this.envioEstado = 'Este navegador no permite compartir archivos. Usa Abrir WhatsApp.'; return; }
    try { await navigator.share({ files: [this.envioArchivo], title: 'Comprobante Maranatha Store' }); this.envioEstado = 'Archivo compartido con la aplicación seleccionada.'; } catch { this.envioEstado = 'No se completó la acción de compartir.'; }
  }
  limpiarPreferenciaImpresion(): void {
    localStorage.removeItem('maranatha.imprimir.formato');
    this.preferenciaImpresion = undefined;
    this.mensaje = 'Preferencia de impresión eliminada.';
    this.esError = false;
  }
  async descargarPdf(venta: Venta): Promise<void> {
    this.verComprobante(venta);
    try {
      await new Promise(res => setTimeout(res, 150));
      const archivo = await this.crearPdfComprobante(venta);
      const url = URL.createObjectURL(archivo); const a = document.createElement('a'); a.href = url; a.download = archivo.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { this.mensaje = 'No se pudo generar el PDF.'; this.esError = true; }
  }
  qrDataUrl(venta: Venta): string {
    const payload = `TIPO:${venta.tipoComprobante}|SERIE:${venta.serie}-${venta.numero}|TOTAL:${venta.total}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payload)}`;
  }
  textoTipo(tipo: TipoComprobante): string {
    return tipo.replace('_', ' ');
  }
  private mostrarError(error: HttpErrorResponse, fallback: string): void {
    this.mensaje = (error.error as ApiError)?.message
      || (error.status === 0 ? 'No hay conexión con el backend.' : fallback);
    this.esError = true;
  }
  private mostrarErrorSimple(mensaje: string): void {
    this.mensaje = mensaje;
    this.esError = true;
  }
}
