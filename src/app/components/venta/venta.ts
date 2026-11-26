import { firstValueFrom, timeout } from 'rxjs';
import { BetaWeb, EstadoWeb, LocalWeb, FormatoWeb, betaCoincide, localCoincide, qrWeb, pdfVentaWeb, pdfBetaWeb, descargarWeb, vistaWeb, monedaWeb, etiquetaEstadoWeb, referenciaQrWeb } from '../../core/facturacion-web';
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { ApiError, Cliente, DetalleVenta, Producto, TipoComprobante, Venta } from '../../models';
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrls: ['./venta.css'], templateUrl: './venta.html',
})
export class VentasComponent implements OnInit {
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
    pagoConfirmado = false;
    seleccionarMetodoPago(metodo: typeof this.metodosPago[number]): void {
      this.metodoPago = metodo;
      this.pagoConfirmado = false;
    }
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
          venta.compradorLocalNombre,
          venta.compradorLocalDocumento,
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
    return this.ventaEmitida?.compradorLocalNombre ? this.ventaEmitida.compradorLocalNombre + " (comprador local)" : this.ventaEmitida?.clienteNombre || this.documentoNombre.trim() || this.clienteSeleccionado;
  }
  get comprobanteDocumento(): string {
    if (this.ventaEmitida?.compradorLocalDocumento) return this.ventaEmitida.compradorLocalDocumento;
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
    if (v?.estado === 'ANULADA') return 'Anulado interno';
    if (v?.tipoComprobante === 'NOTA_PEDIDO') return 'No aplica';
    const estado = (v as (Venta & { estadoSunat?: string }) | undefined)?.estadoSunat;
    const etiquetas: Record<string,string> = {"NO_APLICA": "No aplica", "PENDIENTE": "Pendiente", "EN_PROCESO": "En proceso", "ACEPTADO_BETA": "Activo · Beta", "OBSERVADO_BETA": "Observado en Beta", "RECHAZADO_BETA": "Rechazado en Beta", "ERROR_COMUNICACION": "Error de comunicación", "REQUIERE_REVISION": "Requiere revisión", "ACEPTADO": "Aceptado registrado (sin confirmación)", "OBSERVADO": "Observado registrado", "RECHAZADO": "Rechazado registrado"};
    return etiquetas[estado ?? ''] ?? 'Sin registro fiscal';
  }

  ngOnInit(): void {
    this.cargarCatalogos();
    this.cargarVentas();
    const pref = localStorage.getItem('maranatha.imprimir.formato');
    if (pref === 'TICKET' || pref === 'A4') this.preferenciaImpresion = pref as 'TICKET' | 'A4';

    this.api.sesion().subscribe({next:r=>{this.adminWeb=['ADMIN','ROLE_ADMIN'].includes(String(r.rol).toUpperCase());},error:()=>{this.adminWeb=false;}});
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
    if (!this.datosComprobanteCompletos || this.pasoVenta !== 'pago' || this.metodoPago !== 'EFECTIVO' || !this.pagoConfirmado) {
      this.mostrarErrorSimple('Completa los datos y confirma el pago en efectivo.'); return;
    }
    const numero = this.tipo === 'NOTA_PEDIDO' ? undefined : this.documento.trim();
    const nombre = this.tipo === 'NOTA_PEDIDO' ? undefined : [this.documentoNombre, this.tipo === 'BOLETA' ? this.documentoApellidos : ''].join(' ').trim();
    const tipoDocumento = this.tipo === 'FACTURA' ? 'RUC' as const : this.tipo === 'BOLETA' ? 'DNI' as const : undefined;
    const bytes = crypto.getRandomValues(new Uint8Array(16)); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const h = Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('');
    this.claveVentaActual ??= h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
    const clave = this.claveVentaActual;
    const solicitud = { idempotencyKey: clave, metodoPago: this.metodoPago, tipoComprobante: this.tipo,
      documento: numero, compradorNombre: nombre, tipoDocumento, numeroDocumento: numero, clienteNombre: nombre,
      detalles: this.detalles.map(item => ({productoId:item.productoId,cantidad:item.cantidad})) };
    this.procesando=true; this.mensaje='';
    this.api.crearVenta(solicitud,clave).subscribe({next: async venta => {
      if(['B9B1','F9B1'].includes(venta.serie)) {
        try { await this.evidenciaPropia(venta); }
        catch { this.procesando=false; this.requiereRevision=true; this.cargarVentas(); this.mostrarErrorSimple('Venta registrada; resultado fiscal no verificado. Revisa el historial y no vuelvas a cobrar.'); return; }
      }
      this.procesando=false; this.claveVentaActual=undefined; this.ventaEmitida=venta; this.detalles=[];
      this.mensaje='Venta registrada: '+venta.serie+'-'+venta.numero; this.esError=false;
      this.cargarCatalogos(); this.cargarVentas(); void this.compartirComprobante(venta,true);
    },error: error => { this.procesando=false; this.requiereRevision=true;
      this.mostrarError(error,'Registro sin confirmar. Revisa el historial antes de volver a registrar.'); } });
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

    void this.consultarFiscalWeb(venta);
  }
  reimprimir(venta: Venta): void {
    this.ventaEmitida = venta;
    this.mostrarFormularioVenta = true;
    this.pasoVenta = 'carrito';
    this.mostrarDialogoImpresion = true;

    void this.consultarFiscalWeb(venta);
  }
  nuevoComprobante(): void {
    if (this.procesando || this.requiereRevision) { this.mostrarErrorSimple('Revisa el registro anterior antes de iniciar otra venta.'); return; }

    if (this.requiereRevision) { this.mostrarErrorSimple('Revisa el historial antes de repetir la operacion.'); return; }
    this.claveVentaActual = undefined;
    if (this.requiereRevision) { this.mostrarErrorSimple('Revisa el historial antes de repetir la operacion.'); return; }
    this.claveVentaActual = undefined;
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
    this.consultaDocumentoId++;
    this.documentoBuscando = false;
    this.mostrarFormularioVenta = false;
    this.mostrarDialogoImpresion = false;
  }
  abrirDialogoImpresion(): void { this.mostrarDialogoImpresion=true; }

  async seleccionarFormato(formato: FormatoWeb): Promise<void> {
    const venta=this.ventaEmitida;
    if(!venta) return;
    this.mostrarDialogoImpresion=false;
    await this.exportarVentaWeb(venta,formato,false);
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
    const {default: html2canvas} = await import('html2canvas');
    return html2canvas(el, {scale: 2, backgroundColor: '#fff', useCORS: true, onclone: (doc: Document) => {
      const copia = doc.querySelector<HTMLElement>(selector);
      if (copia) { copia.style.display='block'; copia.style.transform='none'; copia.style.backgroundColor='#fff'; copia.style.color='#111'; if(formato==='TICKET') copia.style.width='52mm'; }
      const panel = doc.querySelector<HTMLElement>('#comprobante');
      if(panel) { panel.style.backgroundColor='#fff'; panel.style.color='#111'; }
    }});
  }
  private async evidenciaPropia(v: Venta): Promise<BetaWeb> {
    if(v.estado==='ANULADA' || (v as Venta & {estadoSunat?:string}).estadoSunat!=='ACEPTADO_BETA' || !['B9B1','F9B1'].includes(v.serie)) throw Error('Comprobante no aceptado');
    const b=await firstValueFrom(this.api.evidenciaVentaBetaWeb(v.serie,v.numero).pipe(timeout(15000)));
    if(!betaCoincide(b,v.numero)||b.comprobante!==v.serie+'-'+v.numero||(v.serie==='B9B1'&&v.tipoComprobante!=='BOLETA')||(v.serie==='F9B1'&&v.tipoComprobante!=='FACTURA')||Math.round(Number(b.total)*100)!==Math.round(v.total*100)) throw Error('Evidencia no coincide');
    return b;
  }
  private async crearPdfComprobante(venta: Venta): Promise<File> {
    if(venta.estado!=='ANULADA' && ['B9B1','F9B1'].includes(venta.serie)){const b=await this.evidenciaPropia(venta);return pdfBetaWeb(b,await qrWeb(b.contenidoQr),'A4',venta);}
    const datos=await this.consultarFiscalWeb(venta);
    return pdfVentaWeb(venta,'A4',datos.estado,datos.local);
  }
  envioVenta?: Venta;
  envioArchivo?: File;
  envioCanal: 'whatsapp' | 'correo' | 'enlace' | '' = '';
  envioEnlace = '';
  envioNumero = '';
  envioPais: CountryCode = 'PE';
  readonly paises = getCountries().map(codigo => ({codigo, nombre: new Intl.DisplayNames(['es'], {type:'region'}).of(codigo) || codigo, prefijo: '+'+getCountryCallingCode(codigo), bandera: Array.from(codigo).map(c=>String.fromCodePoint(127397+c.charCodeAt(0))).join('')})).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
  get envioPrefijo(): string { return '+'+getCountryCallingCode(this.envioPais); }
  seleccionarCanal(canal: 'whatsapp'|'correo'|'enlace'): void { this.envioCanal=canal; this.envioEstado=''; }
  envioCorreo = '';
  envioEstado = '';
  envioOcupado = false;
  ventaRecienRegistrada = false;
  async compartirComprobante(venta: Venta, recienRegistrada = false): Promise<void> {
    this.ventaRecienRegistrada = recienRegistrada;
    this.verComprobante(venta);
    this.envioVenta=venta; this.envioArchivo=undefined; this.envioEstado='Preparando PDF…'; this.envioOcupado=true;
    this.envioPais='PE'; this.envioNumero=''; this.envioCorreo=''; this.envioCanal=''; this.envioEnlace='';
    try {
      await new Promise(r=>setTimeout(r,150));
      this.envioArchivo=await this.crearPdfComprobante(venta); this.envioEstado='';
    }catch(e){this.envioEstado='No se pudo preparar el PDF.';}finally{this.envioOcupado=false;}
  }
  enviarCorreoComprobante(): void {
    if(this.envioVenta && ['B9B1','F9B1','NP9B'].includes(this.envioVenta.serie)){this.envioEstado='Demo: descarga y comparte el PDF manualmente con destinatarios autorizados.';return;}
    if(!this.envioVenta||!this.envioArchivo||this.envioOcupado)return;
    const correo=this.envioCorreo.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)){this.envioEstado='Ingresa un correo válido.';return;}
    this.envioOcupado=true;this.envioEstado='Enviando…';
    this.api.enviarCorreo(this.envioVenta.id,correo,this.envioArchivo).subscribe({next:()=>{this.envioEstado='Correo aceptado por el servidor SMTP.';this.envioOcupado=false;},error:()=>{this.envioEstado='No se pudo enviar. Revisa la configuración SMTP o la conexión.';this.envioOcupado=false;}});
  }
  abrirWhatsAppComprobante(): void {
    if(this.envioVenta && ['B9B1','F9B1','NP9B'].includes(this.envioVenta.serie)){this.envioEstado='Demo: descarga y comparte el PDF manualmente con destinatarios autorizados.';return;}
    if(!this.envioArchivo)return;
    const telefono = parsePhoneNumberFromString(this.envioNumero.trim(), this.envioPais);
    if (!telefono || !telefono.isValid() || telefono.country !== this.envioPais) {this.envioEstado='Ingresa un número válido para el país seleccionado.';return;}
    const numero=telefono.number.slice(1);
    if(!this.envioVenta || this.envioOcupado)return;
    const popup=window.open('about:blank','_blank');
    if(!popup){this.envioEstado='Permite ventanas emergentes para abrir WhatsApp.';return;}
    popup.opener=null;
    this.envioOcupado=true;
    this.api.crearEnlaceComprobante(this.envioVenta.id,this.envioArchivo).subscribe({next:r=>{
      popup.location.href=`https://wa.me/${numero}?text=${encodeURIComponent('Gracias por su compra en Maranatha Store. Descargue su comprobante: '+r.url)}`;
      this.envioEstado='Confirma el envío en WhatsApp.';this.envioOcupado=false;
    },error:()=>{popup.close();this.envioEstado='No se pudo generar el enlace.';this.envioOcupado=false;}});
  }
  generarEnlaceComprobante(): void {
    if(this.envioVenta && ['B9B1','F9B1','NP9B'].includes(this.envioVenta.serie)){this.envioEstado='Demo: descarga y comparte el PDF manualmente.';return;}
    this.seleccionarCanal('enlace');
    if(this.envioEnlace)return;
    if(!this.envioVenta||!this.envioArchivo||this.envioOcupado)return;
    this.envioOcupado=true;
    this.api.crearEnlaceComprobante(this.envioVenta.id,this.envioArchivo).subscribe({next:r=>{this.envioEnlace=r.url;this.envioOcupado=false;this.envioEstado='Enlace listo. Puedes copiarlo.';},error:()=>{this.envioOcupado=false;this.envioEstado='No se pudo generar el enlace.';}});
  }
  async copiarEnlaceComprobante(): Promise<void> {
    if(!this.envioEnlace)return;
    try { await navigator.clipboard.writeText(this.envioEnlace); this.envioEstado='Enlace copiado.'; }
    catch { this.envioEstado='No se pudo copiar automáticamente. Selecciona el enlace y presiona Ctrl+C.'; }
  }
  descargarArchivoEnvio(): void {
    if(!this.envioArchivo)return;
    const url=URL.createObjectURL(this.envioArchivo);const a=document.createElement('a');a.href=url;a.download=this.envioArchivo.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  imprimirDesdeEnvio(formato: 'TICKET'|'A4'): void {this.seleccionarFormato(formato);}
  async compartirArchivoMovil(): Promise<void> {
    if(!this.envioArchivo)return;
    if(!navigator.canShare?.({files:[this.envioArchivo]})){this.envioEstado='Este navegador no permite compartir archivos. Usa Abrir WhatsApp.';return;}
    try{await navigator.share({files:[this.envioArchivo],title:'Comprobante Maranatha Store'});this.envioEstado='Archivo compartido con la aplicación seleccionada.';}catch{this.envioEstado='No se completó la acción de compartir.';}
  }
  limpiarPreferenciaImpresion(): void {
    localStorage.removeItem('maranatha.imprimir.formato');
    this.preferenciaImpresion = undefined;
    this.mensaje = 'Preferencia de impresión eliminada.';
    this.esError = false;
  }
  async descargarPdf(venta: Venta): Promise<void> { this.verComprobante(venta); await this.exportarVentaWeb(venta,'A4',true); }
  qrDataUrl(_venta: Venta): string { return ''; }
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

  adminWeb=false;
  labAbiertoWeb=false;
  betaNumeroWeb='00000010';
  betaDatoWeb?: BetaWeb;
  betaQrWeb='';
  betaErrorWeb='';
  betaOcupadoWeb=false;
  private qrInternosWeb = new Map<number,string>();
  qrInternoWeb(v?: Venta): string { return v && v.estado !== 'ANULADA' ? this.qrInternosWeb.get(v.id) || '' : ''; }
  private estadosWeb = new Map<number,EstadoWeb>();
  private localesWeb = new Map<number,LocalWeb>();
  estadoFiscalWeb(v?: Venta): string {
    if (!v || v.estado==='ANULADA' || v.tipoComprobante==='NOTA_PEDIDO') return this.estadoFiscal(v);
    const e=this.estadosWeb.get(v.id);
    return e ? etiquetaEstadoWeb(e.estadoSunat) : etiquetaEstadoWeb((v as Venta & {estadoSunat?:string}).estadoSunat);
  }
  monedaFiscalWeb(campo: 'gravado'|'igv'|'exonerado'|'inafecto'): string {
    const v=this.ventaEmitida;
    if(!v || v.tipoComprobante==='NOTA_PEDIDO') return 'No aplica';
    const l=this.localesWeb.get(v.id);
    if(l && localCoincide(v,l)) return monedaWeb(l[campo]);
    const valor=campo==='gravado'?this.comprobanteBase:campo==='igv'?this.comprobanteIgv:campo==='exonerado'?this.comprobanteExonerado:this.comprobanteInafecto;
    return valor==null?'No disponible':monedaWeb(valor)+' (calculado)';
  }
  private async consultarFiscalWeb(v: Venta): Promise<{estado:string;local?:LocalWeb}> {
    if(['B9B1','F9B1'].includes(v.serie)) {
      this.qrInternosWeb.delete(v.id);
      if(v.estado!=='ANULADA')try{const b=await this.evidenciaPropia(v);const qr=await qrWeb(b.contenidoQr);if(qr)this.qrInternosWeb.set(v.id,qr);}catch{/* No QR si evidencia no verificable */}
    }else if(!this.qrInternosWeb.has(v.id)){const qr=await qrWeb(referenciaQrWeb(v)).catch(()=> '');if(qr)this.qrInternosWeb.set(v.id,qr);}
    if(v.tipoComprobante==='NOTA_PEDIDO')return {estado:'No aplica'};
    const [estado,local]=await Promise.all([
      firstValueFrom(this.api.estadoFiscalWeb(v.id).pipe(timeout(6000))).catch(()=>undefined),
      this.adminWeb ? firstValueFrom(this.api.comprobanteLocalWeb(v.id).pipe(timeout(6000))).catch(()=>undefined) : Promise.resolve(undefined)
    ]);
    this.estadosWeb.delete(v.id); this.localesWeb.delete(v.id);
    if(estado && String(estado.ventaId)===String(v.id) && String(estado.serie)===String(v.serie) && String(estado.numero)===String(v.numero))this.estadosWeb.set(v.id,estado);
    if(local && localCoincide(v,local))this.localesWeb.set(v.id,local);
    return {estado:this.estadoFiscalWeb(v)+(this.estadosWeb.has(v.id)?'':' (registro de venta; consulta no confirmada)'),local:this.localesWeb.get(v.id)};
  }
  async exportarVentaWeb(v: Venta, formato: FormatoWeb, descargar: boolean): Promise<void> {
    const popup=descargar?null:window.open('about:blank','_blank');
    if(!descargar&&!popup){this.mostrarErrorSimple('Permite ventanas emergentes para abrir el PDF.');return;}
    if(popup)popup.opener=null;
    try{const datos=await this.consultarFiscalWeb(v);const archivo= v.estado!=='ANULADA' && ['B9B1','F9B1'].includes(v.serie) ? await this.evidenciaPropia(v).then(async b=>pdfBetaWeb(b,await qrWeb(b.contenidoQr),formato,v)) : await pdfVentaWeb(v,formato,datos.estado,datos.local);if(popup)vistaWeb(archivo,popup);else descargarWeb(archivo);}
    catch{popup?.close();this.mostrarErrorSimple('No se pudo generar el PDF.');}
  }
  abrirLaboratorioWeb(): void {
    this.labAbiertoWeb=!this.labAbiertoWeb;
    if(this.labAbiertoWeb && !this.betaDatoWeb)void this.consultarBetaWeb();
  }
  async refrescarEstadoWeb(v: Venta): Promise<void> {
    await this.consultarFiscalWeb(v);
    if(!this.estadosWeb.has(v.id) && v.tipoComprobante!=='NOTA_PEDIDO')this.mostrarErrorSimple('No se pudo confirmar el estado SUNAT de esta venta. Revisa el acceso y el backend.');
  }
  async emitirLaboratorioWeb(): Promise<void> {
    if(!this.adminWeb || this.betaOcupadoWeb)return;
    if(!window.confirm('Generar factura sintetica SUNAT Beta (sin validez fiscal). No modifica ventas comerciales.'))return;
    const key='maranatha-lab-operacion';
    try {
      const op=sessionStorage.getItem(key)||crypto.randomUUID(); sessionStorage.setItem(key,op);
      this.betaOcupadoWeb=true;this.betaDatoWeb=undefined;this.betaQrWeb='';this.betaErrorWeb='';
      const r=await firstValueFrom(this.api.emitirLaboratorioWeb(op).pipe(timeout(120000)));
      if(r.ambiente!=='BETA'||r.validezFiscal||r.serie!=='F9B1'||!/^\d{8}$/.test(r.numero))throw Error('Respuesta inconsistente');
      this.betaNumeroWeb=r.numero;
      if(r.estadoSunat==='ACEPTADO_BETA'&&r.codigo==='0') {this.betaOcupadoWeb=false;await this.consultarBetaWeb();if(this.betaDatoWeb)sessionStorage.removeItem(key);}
      else {this.betaErrorWeb='Resultado: '+r.serie+'-'+r.numero+' · '+r.estadoSunat+'. Revise antes de otra emision.';}
    } catch {this.betaErrorWeb='Emision no confirmada. Comprueba el laboratorio; se conserva la misma operacion para consultar sin duplicar.';}
    finally {this.betaOcupadoWeb=false;}
  }
  async consultarBetaWeb(): Promise<void> {
    if(!this.adminWeb || this.betaOcupadoWeb || !/^\d{8}$/.test(this.betaNumeroWeb))return;
    const numero=this.betaNumeroWeb;this.betaOcupadoWeb=true;this.betaDatoWeb=undefined;this.betaQrWeb='';this.betaErrorWeb='';
    try{const b=await firstValueFrom(this.api.evidenciaBetaWeb(numero).pipe(timeout(10000)));if(!betaCoincide(b,numero))throw Error('Evidencia no confirmada');const qr=await qrWeb(b.contenidoQr);if(this.betaNumeroWeb===numero){this.betaDatoWeb=b;this.betaQrWeb=qr;}}
    catch{this.betaErrorWeb='No se pudo confirmar la evidencia archivada. Revisa el correlativo y el acceso de administrador.';}
    finally{this.betaOcupadoWeb=false;}
  }
  exportarBetaWeb(formato: FormatoWeb, descargar: boolean): void {
    if(!this.adminWeb||!this.betaDatoWeb||!this.betaQrWeb||!betaCoincide(this.betaDatoWeb,this.betaNumeroWeb))return;
    try{const archivo=pdfBetaWeb(this.betaDatoWeb,this.betaQrWeb,formato);if(descargar)descargarWeb(archivo);else{const popup=window.open('about:blank','_blank');if(!popup){this.betaErrorWeb='Permite ventanas emergentes.';return;}popup.opener=null;vistaWeb(archivo,popup);}}
    catch{this.betaErrorWeb='No se pudo generar el PDF de evidencia.';}
  }

}
