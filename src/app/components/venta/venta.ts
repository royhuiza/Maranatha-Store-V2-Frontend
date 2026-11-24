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
    if (this.procesando || !this.detalles.length) return;
    if (this.pasoVenta !== 'pago' || this.metodoPago !== 'EFECTIVO' || !this.pagoConfirmado) {
      this.mostrarErrorSimple('Confirma el pago en efectivo antes de registrar la venta.');
      return;
    }
    // El cobro digital permanece bloqueado hasta integrar la conciliación.
    this.procesando = true;
    this.mensaje = '';
    this.api.crearVenta({
      documento: this.documento.trim() || undefined,
      compradorNombre: [this.documentoNombre, this.tipo === 'BOLETA' ? this.documentoApellidos : ''].join(' ').trim() || undefined,
      metodoPago: this.metodoPago,
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
        void this.compartirComprobante(venta, true);
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
  abrirDialogoImpresion(): void {
    if (this.preferenciaImpresion) {
      this.seleccionarFormato(this.preferenciaImpresion);
      return;
    }
    this.mostrarDialogoImpresion = true;
  }
  async seleccionarFormato(formato: 'TICKET' | 'A4'): Promise<void> {
    this.mostrarDialogoImpresion = false;
    if (this.usarSiempreImpresion) {localStorage.setItem('maranatha.imprimir.formato', formato);this.preferenciaImpresion=formato;}
    const popup = window.open('', '_blank', 'width=800,height=850');
    if (!popup) { this.mensaje='Permite las ventanas emergentes para imprimir.'; this.esError=true; return; }
    try {
      const canvas = await this.capturarComprobante(formato);
      const ancho = formato === 'A4' ? '190mm' : '52mm';
      const pagina = formato === 'A4' ? 'A4' : 'auto';
      popup.document.open();
      popup.document.write(`<!doctype html><html><head><title>Comprobante</title><style>@page{size:${pagina};margin:3mm}body{margin:0;background:white}img{display:block;width:${ancho};max-width:100%;height:auto;margin:auto;${formato==='A4'?'max-height:277mm;object-fit:contain;':''}}</style></head><body></body></html>`);
      popup.document.close();
      const img = popup.document.createElement('img');
      img.alt = 'Comprobante'; img.src = canvas.toDataURL('image/png');
      popup.document.body.appendChild(img);
      await img.decode(); popup.focus(); popup.print();
    } catch { popup.close(); this.mensaje='No se pudo preparar la impresión.'; this.envioEstado=this.mensaje; this.esError=true; }
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
  private async crearPdfComprobante(venta: Venta): Promise<File> {
    const canvas = await this.capturarComprobante();
    const {jsPDF} = await import('jspdf');
    const pdf = new jsPDF({unit:'mm',format:'a4'});
    const ratio = Math.min(190/canvas.width,277/canvas.height);
    const w=canvas.width*ratio, h=canvas.height*ratio;
    pdf.addImage(canvas.toDataURL('image/png'),'PNG',(210-w)/2,10,w,h);
    return new File([pdf.output('blob')],`comprobante-${venta.serie}-${venta.numero}.pdf`,{type:'application/pdf'});
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
    if(!this.envioVenta||!this.envioArchivo||this.envioOcupado)return;
    const correo=this.envioCorreo.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)){this.envioEstado='Ingresa un correo válido.';return;}
    this.envioOcupado=true;this.envioEstado='Enviando…';
    this.api.enviarCorreo(this.envioVenta.id,correo,this.envioArchivo).subscribe({next:()=>{this.envioEstado='Correo aceptado por el servidor SMTP.';this.envioOcupado=false;},error:()=>{this.envioEstado='No se pudo enviar. Revisa la configuración SMTP o la conexión.';this.envioOcupado=false;}});
  }
  abrirWhatsAppComprobante(): void {
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
  async descargarPdf(venta: Venta): Promise<void> {
    this.verComprobante(venta);
    try {
      await new Promise(res=>setTimeout(res,150));
      const archivo=await this.crearPdfComprobante(venta);
      const url=URL.createObjectURL(archivo); const a=document.createElement('a'); a.href=url; a.download=archivo.name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),60000);
    } catch { this.mensaje='No se pudo generar el PDF.'; this.esError=true; }
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
