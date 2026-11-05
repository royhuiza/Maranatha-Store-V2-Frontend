import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { ApiService } from '../core/api.service';
import { ApiError, Cliente, DetalleVenta, Producto, TipoComprobante, Venta } from '../models';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-title no-print">
      <div><h2>Venta y facturación</h2><p>Boleta, factura o nota de pedido con control automático de stock</p></div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="secondary" (click)="nuevoComprobante()">Nueva venta</button>
        <button *ngIf="preferenciaImpresion" class="secondary" (click)="limpiarPreferenciaImpresion()">Cambiar formato impresión</button>
      </div>
    </div>
    <div *ngIf="mensaje" class="notice no-print" [class.error-notice]="esError">{{ mensaje }}</div>

    <div class="modal" *ngIf="mostrarDialogoImpresion">
      <div class="dialog">
        <h3>¿Qué formato desea imprimir?</h3>
        <p>Elija <b>Ticket</b> para recibos pequeños o <b>A4</b> para hoja completa.</p>
        <div class="actions">
          <label style="margin-right:auto"><input type="checkbox" [(ngModel)]="usarSiempreImpresion"> Usar siempre este formato</label>
          <button class="secondary" (click)="seleccionarFormato('TICKET')">Ticket</button>
          <button class="primary-wide" (click)="seleccionarFormato('A4')">A4</button>
          <button class="secondary" (click)="mostrarDialogoImpresion=false">Cancelar</button>
        </div>
      </div>
    </div>

    <div class="sale-grid">
      <section class="panel no-print">
        <h3>Datos del comprobante</h3>
        
<div class="row">
  <label>Tipo de comprobante
    <select [(ngModel)]="tipo" (ngModelChange)="onTipoChange()">
      <option value="BOLETA">Boleta</option>
      <option value="FACTURA">Factura</option>
      <option value="NOTA_PEDIDO">Nota de pedido</option>
    </select>
  </label>
</div>

<div *ngIf="tipo === 'FACTURA'">

    <!-- 1. RUC -->
    <div class="row">
      <label>RUC
        <input
          type="text"
          [(ngModel)]="documento"
          (ngModelChange)="onDocumentoChange()"
          maxlength="11"
          inputmode="numeric"
          placeholder="Ingrese RUC de 11 dígitos">
      </label>

      <button
        type="button"
        class="secondary"
        (click)="buscarDocumento()"
        [disabled]="documentoBuscando || documento.length !== 11">
        {{ documentoBuscando ? 'Consultando...' : 'Consultar SUNAT' }}
      </button>
    </div>

    <!-- 2. RAZÓN SOCIAL -->
    <div class="row">
      <label>Razón social
        <input
          type="text"
          [(ngModel)]="documentoNombre"
          placeholder="Razón social del cliente">
      </label>
    </div>

    <!-- 3. DIRECCIÓN FISCAL -->
    <div class="row">
      <label>Dirección fiscal
        <input
          type="text"
          [(ngModel)]="documentoDireccion"
          placeholder="Dirección fiscal del cliente">
      </label>
    </div>

    <small class="hint">
      La consulta automática oficial estará disponible
      cuando se habilite el servicio correspondiente.
    </small>

  </div>


        <div *ngIf="tipo === 'BOLETA'" class="row">
          <label>DNI del comprador
            <input
              type="text"
              [(ngModel)]="documento"
              (ngModelChange)="onDocumentoChange()"
              maxlength="8"
              inputmode="numeric"
              placeholder="Ingrese DNI cuando corresponda">
          </label>
        </div>

        <small class="error" *ngIf="documentoError">
          {{ documentoError }}
        </small>


        <div class="row product-row product-search-row">
          <label>Producto
            <input type="text" [(ngModel)]="productoFiltro" (ngModelChange)="onProductoFiltroChange()" placeholder="Ingrese las primeras letras del producto" autocomplete="off">
            <div class="suggestions" *ngIf="productoFiltro">
              <div *ngFor="let p of productosFiltrados" class="suggestion" [class.selected]="productoId === p.id" [class.disabled]="p.stock===0" (click)="p.stock > 0 && seleccionarProducto(p.id)">
                {{ p.nombre }} — S/ {{ p.precio | number:'1.2-2' }} — stock {{ p.stock }}
              </div>
              <div *ngIf="!productosFiltrados.length" class="hint">No se encontró producto.</div>
            </div>
          </label>
        </div>
        <div class="row product-row">
          <label>Cantidad<input type="number" min="1" step="1" [(ngModel)]="cantidad"></label>
          <button (click)="agregar()" [disabled]="!productoId">Agregar al carrito</button>
        </div>

        <div class="table-wrap mini">
          <table>
            <thead><tr><th>Producto</th><th>Cant.</th><th>P. unit.</th><th>Subtotal</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let d of detalles; let i=index">
                <td>{{ d.productoNombre }}</td>
                <td>{{ d.cantidad }}</td>
                <td>S/ {{ d.precioUnitario | number:'1.2-2' }}</td>
                <td>S/ {{ d.subtotal | number:'1.2-2' }}</td>
                <td><button class="link danger-text" (click)="quitar(i)">Quitar</button></td>
              </tr>
              <tr *ngIf="!detalles.length"><td colspan="5" class="empty">Agregue productos para registrar la venta.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="total"><span>Total</span><strong>S/ {{ totalBorrador | number:'1.2-2' }}</strong></div>
        <button class="primary-wide" [disabled]="!detalles.length || procesando" (click)="registrar()">
          {{ procesando ? 'Registrando...' : 'Registrar e imprimir' }}
        </button>
      </section>

      <section class="panel receipt" id="comprobante">
        <div class="comprobante-a4">
          <div class="receipt-head receipt-head-grid">
            <div class="company">
              <h2>MARANATHA STORE</h2>
              <div class="company-sub">Librería escolar</div>
              <div class="company-small">Tacna, Perú</div>
              <div class="ruc-line"><span class="ruc-label">RUC</span> <span class="ruc-number">20XXXXXXXXX</span></div>
            </div>
            <div class="comprobante-block">
              <div class="comprobante-type">{{ comprobanteTipo }}</div>
              <div class="serie-number"><span *ngIf="ventaEmitida">{{ ventaEmitida.serie }}-{{ ventaEmitida.numero }}</span><span *ngIf="!ventaEmitida">(BORRADOR)</span></div>
            </div>
            <div class="qr-block" *ngIf="ventaEmitida">
              <img [src]="qrDataUrl(ventaEmitida)" alt="QR" class="qr-img" crossOrigin="anonymous">
            </div>
          </div>

          <hr>
          <p>
            Fecha: {{ comprobanteFecha | date:'dd/MM/yyyy HH:mm' }}<br>
            Estado: {{ ventaEmitida?.estado || 'BORRADOR' }}
          </p>
          <p>Cliente: {{ comprobanteCliente }}<br><small *ngIf="comprobanteDocumento">{{ comprobanteDocumento }}</small></p>

          <table class="items">
            <thead><tr><th>Cant.</th><th>U.M.</th><th>Descripción</th><th class="right">Precio</th><th class="right">Importe</th></tr></thead>
            <tbody>
              <tr *ngFor="let d of comprobanteDetalles">
                <td>{{ d.cantidad }}</td>
                <td>UND</td>
                <td>{{ d.productoNombre }}</td>
                <td class="right">S/ {{ d.precioUnitario | number:'1.2-2' }}</td>
                <td class="right">S/ {{ d.subtotal | number:'1.2-2' }}</td>
              </tr>
            </tbody>
          </table>

          <hr>
          <table class="tax-summary">
            <tr><td class="label">Op. Gravada</td><td class="value">S/ {{ comprobanteBase | number:'1.2-2' }}</td></tr>
            <tr><td class="label">IGV ({{ (igvRate*100) | number:'1.0-0' }}%)</td><td class="value">S/ {{ comprobanteIgv | number:'1.2-2' }}</td></tr>
            <tr class="total"><td class="label"><strong>TOTAL</strong></td><td class="value"><strong>S/ {{ comprobanteTotalConIgv | number:'1.2-2' }}</strong></td></tr>
          </table>

          <small>Gracias por su compra</small>
          <div class="receipt-legend">
            <small>Representación impresa del comprobante. Este sistema no está asociado a SUNAT; el documento mostrado no constituye comprobante fiscal validado por SUNAT.</small>
          </div>
        </div>

        <div class="comprobante-ticket">
          <div class="ticket-head">
            <h3>MARANATHA STORE</h3>
            <div class="company-sub">Librería escolar</div>
            <div class="ruc-line"><span class="ruc-label">RUC</span> <span class="ruc-number">20XXXXXXXXX</span></div>
            <div class="ticket-meta">
              <span class="comprobante-type small">{{ comprobanteTipo }}</span>
              <span class="serie-number small"><span *ngIf="ventaEmitida">{{ ventaEmitida.serie }}-{{ ventaEmitida.numero }}</span><span *ngIf="!ventaEmitida">(BORRADOR)</span></span>
            </div>
          </div>
          <div class="ticket-body">
            <div>Fecha: {{ comprobanteFecha | date:'dd/MM/yyyy HH:mm' }}</div>
            <div>Cliente: {{ comprobanteCliente }}</div>
            <div class="ticket-items">
              <div *ngFor="let d of comprobanteDetalles" class="ticket-item">
                <span>{{ d.cantidad }} x {{ d.productoNombre }}</span>
                <span class="right">S/ {{ d.subtotal | number:'1.2-2' }}</span>
              </div>
            </div>
            <div class="ticket-totals">
              <div><span>SUBTOTAL</span><span class="right">S/ {{ comprobanteBase | number:'1.2-2' }}</span></div>
              <div><span>IGV</span><span class="right">S/ {{ comprobanteIgv | number:'1.2-2' }}</span></div>
              <div class="total"><span><strong>TOTAL</strong></span><span class="right"><strong>S/ {{ comprobanteTotalConIgv | number:'1.2-2' }}</strong></span></div>
            </div>
            <div class="ticket-qr" *ngIf="ventaEmitida"><img [src]="qrDataUrl(ventaEmitida)" alt="QR"></div>
            <div class="receipt-legend small">Representación impresa. No validado por SUNAT.</div>
          </div>
        </div>
      </section>
    </div>

    <section class="panel history no-print">
      <div class="history-title"><div><h3>Comprobantes emitidos</h3><p>Las ventas anuladas conservan el historial y reponen el stock.</p></div></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Comprobante</th><th>Fecha</th><th>Cliente</th><th>Total</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let v of ventas">
              <td><b>{{ v.serie }}-{{ v.numero }}</b><br><small>{{ textoTipo(v.tipoComprobante) }}</small></td>
              <td>{{ v.fecha | date:'dd/MM/yyyy HH:mm' }}</td>
              <td>{{ v.clienteNombre }}</td>
              <td>S/ {{ v.total | number:'1.2-2' }}</td>
              <td><span class="status" [class.danger]="v.estado==='ANULADA'">{{ v.estado }}</span></td>
              <td>
                <button class="link" (click)="reimprimir(v)">Imprimir</button>
                <button class="link" (click)="descargarPdf(v)">PDF</button>
                <button *ngIf="v.estado==='EMITIDA'" class="link danger-text" (click)="anular(v)">Anular</button>
              </td>
            </tr>
            <tr *ngIf="!ventas.length"><td colspan="6" class="empty">Todavía no hay ventas registradas.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  `
})
export class VentasComponent implements OnInit {
  private readonly api = inject(ApiService);
  productos: Producto[] = [];
  clientes: Cliente[] = [];
  ventas: Venta[] = [];
  tipo: TipoComprobante = 'BOLETA';
  clienteId?: number;
  productoId?: number;
  cantidad = 1;
  documento = '';
  documentoNombre = '';
  documentoDireccion = '';
  documentoError = '';
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
    return this.ventaEmitida?.clienteNombre || this.clienteSeleccionado;
  }

  get comprobanteDocumento(): string {
    if (this.ventaEmitida?.clienteDocumento) return this.ventaEmitida.clienteDocumento;
    const cliente = this.clientes.find(item => item.id === this.clienteId);
    if (cliente?.numeroDocumento) return `${cliente.tipoDocumento} ${cliente.numeroDocumento}`;
    if (this.documento) return `${this.tipo === 'BOLETA' ? 'DNI' : 'RUC'} ${this.documento}`;
    return '';
  }

  get productosFiltrados(): Producto[] {
    const filtro = this.productoFiltro.trim().toLowerCase();
    return filtro
      ? this.productos.filter(item => item.nombre.toLowerCase().includes(filtro))
      : this.productos;
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

  get comprobanteBase(): number {
    const total = this.ventaEmitida?.total ?? this.totalBorrador;
    return this.preciosIncluyenIgv ? total / (1 + this.igvRate) : total;
  }

  get comprobanteIgv(): number {
    return this.comprobanteBase * this.igvRate;
  }

  get comprobanteTotalConIgv(): number {
    return this.comprobanteBase + this.comprobanteIgv;
  }

  ngOnInit(): void {
    this.cargarCatalogos();
    this.cargarVentas();
    const pref = localStorage.getItem('maranatha.imprimir.formato');
    if (pref === 'TICKET' || pref === 'A4') this.preferenciaImpresion = pref as 'TICKET' | 'A4';
  }

  onTipoChange(): void {
    this.ventaEmitida = undefined;
    this.documento = '';
    this.documentoNombre = '';
    this.documentoError = '';
    this.documentoValido = false;
    this.documentoDireccion = '';
  }

  onDocumentoChange(): void {
    this.documentoNombre = '';
    this.documentoError = '';
    this.documentoValido = false;
    this.documentoDireccion = '';
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
    this.documentoError = '';
    this.documentoNombre = '';
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
          this.documentoBuscando = false;
          this.documentoValido = true;
          this.documentoNombre =
            `${data.nombres} ${data.apellidoPaterno} ${data.apellidoMaterno}`.trim();
        },

        error: err => {
          this.documentoBuscando = false;
          const status = err?.status ?? 0;
          const message = err?.message ? ` ${err.message}` : '';
          this.documentoError = status === 0
            ? 'Error de conexión o proxy. Reinicie el servidor de desarrollo y verifique la configuración de proxy.'
            : `No se encontró el DNI. Verifique el número e intente nuevamente. (HTTP ${status})${message}`;
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
          this.documentoBuscando = false;
          this.documentoValido = true;
          this.documentoNombre = data.razonSocial?.trim() || '';
          this.documentoDireccion = data.direccionFiscal?.trim() || '';
        },

        
        error: err => {
          this.documentoBuscando = false;
          this.documentoValido = false;
          const status = err?.status ?? 0;

          if (status === 503) {
            this.documentoError =
              'La consulta RUC oficial todavía no está habilitada. ' +
              'Ingrese la razón social y dirección fiscal manualmente.';
          } else if (status === 401) {
            this.documentoError =
              'Su sesión ha expirado. Inicie sesión nuevamente.';
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
    forkJoin([this.api.productos(), this.api.clientes()]).subscribe({
      next: ([productos, clientes]) => {
        this.productos = productos.filter(item => item.activo !== false);
        this.clientes = clientes.filter(item => item.activo !== false);
        if (!this.productos.some(item => item.id === this.productoId)) {
          this.productoId = this.productos.find(item => item.stock > 0)?.id;
        }
      },
      error: error => this.mostrarError(error, 'No se pudieron cargar productos y clientes.')
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
      this.mostrarErrorSimple(`Stock insuficiente. Solo hay ${producto.stock} unidades disponibles.`);
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
    if (!this.detalles.length) return;
    // Para esta versión provisional, el documento se puede ingresar manualmente así no se valide.

    this.procesando = true;
    this.mensaje = '';
    this.api.crearVenta({
      clienteId: this.clienteId,
      tipoComprobante: this.tipo,
      detalles: this.detalles.map(item => ({ productoId: item.productoId, cantidad: item.cantidad }))
    }).subscribe({
      next: venta => {
        this.procesando = false;
        this.ventaEmitida = venta;
        this.detalles = [];
        this.mensaje = `Venta registrada: ${venta.serie}-${venta.numero}. El stock fue actualizado.`;
        this.esError = false;
        this.cargarCatalogos();
        this.cargarVentas();
        this.abrirDialogoImpresion();
      },
      error: error => {
        this.procesando = false;
        this.mostrarError(error, 'No se pudo registrar la venta.');
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

  reimprimir(venta: Venta): void {
    this.ventaEmitida = venta;
    this.abrirDialogoImpresion();
  }

  nuevoComprobante(): void {
    this.ventaEmitida = undefined;
    this.detalles = [];
    this.tipo = 'BOLETA';
    this.clienteId = undefined;
    this.cantidad = 1;
    this.mensaje = '';
  }

  abrirDialogoImpresion(): void {
    if (this.preferenciaImpresion) {
      this.seleccionarFormato(this.preferenciaImpresion);
      return;
    }
    this.mostrarDialogoImpresion = true;
  }

  seleccionarFormato(formato: 'TICKET' | 'A4'): void {
    this.mostrarDialogoImpresion = false;
    const className = formato === 'TICKET' ? 'print-ticket' : 'print-a4';
    document.body.classList.add(className);

    if (this.usarSiempreImpresion) {
      localStorage.setItem('maranatha.imprimir.formato', formato);
      this.preferenciaImpresion = formato;
    }

    const cleanup = () => {
      document.body.classList.remove(className);
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);
    // Dejar un pequeño retraso para que el DOM aplique clases antes de imprimir
    setTimeout(() => window.print(), 150);
  }

  limpiarPreferenciaImpresion(): void {
    localStorage.removeItem('maranatha.imprimir.formato');
    this.preferenciaImpresion = undefined;
    this.mensaje = 'Preferencia de impresión eliminada.';
    this.esError = false;
  }

  async descargarPdf(venta: Venta): Promise<void> {
    this.ventaEmitida = venta;
    // esperar que la vista se actualice
    await new Promise(res => setTimeout(res, 120));
    const el = document.getElementById('comprobante');
    if (!el) {
      this.mostrarDialogoImpresion = false;
      this.mensaje = 'No se encontró el comprobante en el DOM.';
      this.esError = true;
      return;
    }

    try {
      const modJs = await import('jspdf');
      const modHtml2 = await import('html2canvas');
      const jsPDF = (modJs as any).default || (modJs as any).jsPDF || (modJs as any);
      const html2canvas = (modHtml2 as any).default || (modHtml2 as any);
      const canvas = await (html2canvas as any)(el as HTMLElement, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');

      const formato = this.preferenciaImpresion || 'A4';
      if (formato === 'TICKET') {
        const ticketWidth = 58; // mm
        const pdf = new jsPDF({ unit: 'mm', format: [ticketWidth, 400] });
        const imgProps = (pdf as any).getImageProperties(imgData);
        const pdfWidth = ticketWidth; // mm
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`comprobante-${venta.serie}-${venta.numero}.pdf`);
      } else {
        const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgProps = (pdf as any).getImageProperties(imgData);
        const ratio = Math.min(pageWidth / imgProps.width, pageHeight / imgProps.height);
        const imgWidth = imgProps.width * ratio;
        const imgHeight = imgProps.height * ratio;
        pdf.addImage(imgData, 'PNG', (pageWidth - imgWidth) / 2, 10, imgWidth, imgHeight);
        pdf.save(`comprobante-${venta.serie}-${venta.numero}.pdf`);
      }
    } catch (err) {
      console.error('Error generando PDF:', err);
      // fallback: abrir diálogo de impresión
      this.mensaje = 'No fue posible generar PDF automáticamente. Se abrirá la vista de impresión.';
      this.esError = false;
      this.abrirDialogoImpresion();
    }
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
