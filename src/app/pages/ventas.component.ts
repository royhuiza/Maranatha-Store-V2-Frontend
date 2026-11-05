import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of, Observable, Subscription, switchMap } from 'rxjs';
import { ViewportModalDirective } from '../core/viewport-modal.directive';
import { createReceiptQr } from '../core/receipt-qr';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ApiError, Cliente, DetalleVenta, Producto, TipoComprobante, Venta, DocumentoConsulta } from '../models';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ViewportModalDirective],
  template: `
    <div class="page-title no-print">
      <div><h2>Venta y facturación</h2><p>Boleta, factura o nota de pedido con control automático de stock</p><p class="peru-clock">Hora de Perú · {{horaActual | date:'dd/MM/yyyy HH:mm:ss':'-0500'}}</p></div>
      <div class="sale-heading-actions">
        <button class="workspace-primary" (click)="nuevoComprobante()">Nueva venta</button>
        <button *ngIf="preferenciaImpresion" class="secondary" (click)="limpiarPreferenciaImpresion()">Cambiar formato impresión</button>
      </div>
    </div>
    <div *ngIf="mensaje" class="notice no-print" [class.error-notice]="esError">{{ mensaje }}</div>

    <dialog viewportModal (modalDismiss)="mostrarDialogoImpresion=false" class="modal" *ngIf="mostrarDialogoImpresion">
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
    </dialog>

    <dialog viewportModal (modalDismiss)="stockBloqueado=undefined" class="modal no-print" *ngIf="stockBloqueado" role="alertdialog" aria-modal="true" aria-label="Stock bajo"><section class="dialog stock-warning"><h3>Stock bajo: producto no disponible para venta</h3><p>{{ stockBloqueado.nombre }} tiene {{ stockBloqueado.stock }} unidades. Se requiere stock mayor que 5.</p><h4>Alternativas disponibles</h4><button class="secondary" *ngFor="let p of alternativas" (click)="stockBloqueado=undefined; seleccionarProducto(p.id)">{{ p.nombre }} · {{ disponible(p) }} disponibles</button><p *ngIf="!alternativas.length">No hay alternativas con stock disponible.</p><button (click)="stockBloqueado=undefined">Cerrar</button></section></dialog>
    <ng-template #datosCobro let-metodo="metodo" let-importe="importe">
      <section *ngIf="metodo==='TARJETA'" class="card-provider-panel" aria-live="polite"><span class="eyebrow">TARJETA · CHECKOUT</span><h3>Un pago, desde tu tienda.</h3><p>El formulario seguro se habilitará al conectar la cuenta comercial de la pasarela.</p><div class="card-preview" aria-hidden="true"><span>MARANATHA</span><b>•••• &nbsp; •••• &nbsp; •••• &nbsp; ••••</b><small>VISA / MASTERCARD</small></div><p>No hay conexión de cobro activa. Los datos de tarjeta y CVV se introducirán en el formulario del proveedor.</p><button disabled>Conectar pasarela para pagar</button></section>
      <section class="recipient-payment" *ngIf="metodo==='YAPE' || metodo==='PLIN' || metodo==='TRANSFERENCIA'" aria-label="Datos para pagar">
        <span class="eyebrow">DESTINATARIO DEL NEGOCIO</span><h4>{{metodo==='TRANSFERENCIA' ? 'Transferencia a BCP' : metodo==='PLIN' ? 'Desde Plin, elige destino Yape' : 'Paga con tu aplicación Yape'}}</h4>
        <p>Titular receptor: <strong>Diego Franco Contreras Ramos</strong></p>
        <p class="recipient-amount">Importe a pagar: <strong>S/ {{importe | number:'1.2-2'}}</strong></p>
        <ng-container *ngIf="metodo==='TRANSFERENCIA'; else billetera">
          <p>Banco receptor: <strong>BCP</strong></p><p>CCI: <strong class="recipient-number">00219119654521802054</strong></p><button type="button" class="secondary copy-payment" (click)="copiarCobro('00219119654521802054')">Copiar CCI</button>
          <p>En la aplicación de tu banco selecciona transferencia por CCI, ingresa este CCI y comprueba el titular antes de enviar.</p>
        </ng-container>
        <ng-template #billetera>
          <p>Celular receptor: <strong class="recipient-number">+51 998 482 875</strong></p><button type="button" class="secondary copy-payment" (click)="copiarCobro('998482875')">Copiar número</button>
          <p *ngIf="metodo==='PLIN'">Desde la aplicación de tu banco usa Plin, ingresa 998482875 y selecciona Yape como destino. La disponibilidad depende de tu banco.</p>
          <img *ngIf="metodo==='YAPE'" class="recipient-qr" src="/payments/yape-diego-qr.png" alt="QR de Yape de Diego Franco Contreras Ramos">
          <p>Ingresa el importe indicado en tu aplicación. Este QR no incorpora automáticamente el total de la venta.</p>
        </ng-template>
        <span class="copy-feedback" role="status" *ngIf="copiaCobro">{{copiaCobro}}</span><p class="recipient-pending">Pendiente de verificación manual. Este sistema no comprueba automáticamente el pago.</p>
      </section>
    </ng-template>
    <dialog viewportModal (modalDismiss)="mostrarPago=false" class="modal no-print" *ngIf="mostrarPago" role="dialog" aria-modal="true" aria-label="Resumen de pago"><section class="dialog payment-dialog"><span class="product-dialog-eyebrow">VENTA REGISTRADA</span><h3>Tu venta está lista</h3><p class="payment-reference">{{ventaEmitida?.serie}}-{{ventaEmitida?.numero}}</p><div class="payment-summary-total"><span>Total registrado</span><strong>S/ {{ventaEmitida?.total | number:'1.2-2'}}</strong></div><div class="payment-summary-method"><span>Método previsto</span><b>{{ventaEmitida?.metodoPago || metodoPago || 'SIN ELEGIR'}}</b><span class="status danger">Pago pendiente</span></div><p>No se ha confirmado un ingreso bancario. Verifica el pago en la cuenta receptora.</p><ng-container *ngTemplateOutlet="datosCobro; context: {metodo: ventaEmitida?.metodoPago || metodoPago, importe: ventaEmitida?.total}"></ng-container><div class="payment-next"><b>¿Qué sigue?</b><p>Puedes descargar el comprobante interno o volver a la venta. Un comprobante no acredita el pago.</p></div><div class="actions"><button class="secondary" (click)="mostrarPago=false; ventaDescargas=ventaEmitida">Descargar comprobante</button><button (click)="mostrarPago=false">Volver a ventas</button></div></section></dialog>
    <dialog viewportModal (modalDismiss)="cerrarPdf()" class="modal no-print" *ngIf="pdfPreparado as pdf" aria-label="PDF preparado"><section class="dialog pdf-ready-dialog"><span class="product-dialog-eyebrow">DOCUMENTO GENERADO</span><h3>Tu PDF está listo</h3><p>{{pdf.nombre}}</p><p>Conserva el fondo blanco, el logo y el QR del registro.</p><div class="actions"><button class="secondary" (click)="cerrarPdf()">Cerrar</button><a class="save-pdf-link" [href]="pdf.url" [download]="pdf.nombre">Guardar PDF</a></div></section></dialog>
    <div class="sale-grid">
      <section class="panel sale-workspace no-print">
        <section class="sale-step" aria-labelledby="sale-customer-title">
          <h3 class="sale-step-title" id="sale-customer-title"><span aria-hidden="true">01</span> Datos del comprobante</h3>
          <div class="row">
            <label>Tipo
              <select [(ngModel)]="tipo" (ngModelChange)="onTipoChange()">
                <option value="BOLETA">Boleta</option>
                <option value="FACTURA">Factura</option>
                <option value="NOTA_PEDIDO">Nota de pedido</option>
              </select>
            </label>
            <label>Cliente
              <select [(ngModel)]="clienteId" (ngModelChange)="onClienteSeleccionado()">
                <option [ngValue]="undefined">{{ clienteConsultado ? ((clienteConsultado.nombre + ' ' + (clienteConsultado.apellido || '')).trim()) : 'Público general' }}</option>
                <option *ngFor="let c of clientes" [ngValue]="c.id">{{ c.nombre }} {{ c.apellido }} · {{ c.numeroDocumento || 'sin documento' }}</option>
              </select>
            </label>
            <p class="hint">Precios con IGV incluido automáticamente (18%).</p>
          </div>
          <div *ngIf="tipo==='BOLETA' || tipo==='FACTURA'" class="row">
            <label>{{ tipo === 'BOLETA' ? 'DNI' : 'RUC' }}
              <input type="text" [(ngModel)]="documento" name="documento" (ngModelChange)="onDocumentoChange()" [attr.maxlength]="tipo === 'BOLETA' ? 8 : 11" placeholder="{{ tipo === 'BOLETA' ? 'Ingrese DNI' : 'Ingrese RUC' }}">
            </label>
          </div>
          <button class="secondary" (click)="buscarDocumento()" [disabled]="documentoBuscando || !documento">{{ documentoBuscando ? 'Consultando...' : 'Consultar documento' }}</button><p class="document-status" *ngIf="documentoValido">Datos recibidos de Decolecta. El cliente quedará asociado al registrar la venta.</p>
          <aside class="identity-card" *ngIf="documentoDatos as d" aria-label="Resultado de consulta de documento" aria-live="polite">
            <div class="identity-heading"><span class="identity-avatar">{{d.nombre.slice(0,1)}}</span><div><small>{{d.tipoDocumento === 'DNI' ? 'IDENTIDAD' : 'DATOS TRIBUTARIOS'}} · DECOLECTA</small><h3>{{d.nombre}}</h3></div><span class="identity-check" aria-label="Consulta recibida">✓</span></div>
            <dl><div><dt>{{d.tipoDocumento}}</dt><dd>{{d.numeroDocumento}}</dd></div><ng-container *ngIf="d.tipoDocumento==='DNI'"><div *ngIf="d.nombres"><dt>Nombres</dt><dd>{{d.nombres}}</dd></div><div *ngIf="d.apellidoPaterno"><dt>Apellido paterno</dt><dd>{{d.apellidoPaterno}}</dd></div><div *ngIf="d.apellidoMaterno"><dt>Apellido materno</dt><dd>{{d.apellidoMaterno}}</dd></div><div><dt>Fecha de nacimiento</dt><dd>Decolecta no la proporciona</dd></div></ng-container><div *ngIf="d.estado"><dt>Estado</dt><dd>{{d.estado}}</dd></div><div *ngIf="d.condicion"><dt>Condición</dt><dd>{{d.condicion}}</dd></div><div *ngIf="d.direccion"><dt>Dirección</dt><dd>{{d.direccion}}</dd></div></dl>
          </aside>
          <small class="error" *ngIf="documentoError">{{ documentoError }}</small>
          <small class="warning" *ngIf="tipo==='FACTURA'">La factura exige un cliente con RUC válido de 11 dígitos.</small>

        </section>
        <section class="sale-step" aria-labelledby="sale-products-title">
          <h3 class="sale-step-title" id="sale-products-title"><span aria-hidden="true">02</span> Productos</h3>
          <div class="sale-help-banner no-print"><span aria-hidden="true">✦</span><div><b>Arma tu venta paso a paso</b><p>Busca el primer artículo, elige una cantidad y pulsa Agregar al carrito. Repite con otro producto; el total se actualizará solo.</p></div></div>
          <div class="row product-row product-search-row">
            <label class="sale-search-label">Producto
              <div class="sale-search-control"><input type="text" [(ngModel)]="productoFiltro" (ngModelChange)="onProductoFiltroChange()" placeholder="Buscar por nombre o letra" autocomplete="off" (focus)="mostrarBuscador=!productoId" (blur)="cerrarBuscador()" (keydown.escape)="mostrarBuscador=false" aria-label="Buscar producto" aria-controls="selector-productos" [attr.aria-expanded]="mostrarBuscador"><button class="sale-search-button" type="button" (click)="mostrarBuscador=!mostrarBuscador" aria-label="Mostrar productos coincidentes"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M15.5 15.5 21 21"></path></svg></button></div>
              <div id="selector-productos" class="suggestions product-selector" *ngIf="mostrarBuscador && productoFiltro.trim()" aria-label="Hasta cinco productos coincidentes">
                <div *ngFor="let p of productosFiltrados" class="suggestion" [class.selected]="productoId === p.id" [class.disabled]="p.stock<=5" (mousedown)="$event.preventDefault()" (click)="seleccionarProducto(p.id)" role="button" tabindex="0" (keydown.enter)="seleccionarProducto(p.id)">
                  {{ p.nombre }} — S/ {{ p.precio | number:'1.2-2' }} — disponible {{ disponible(p) }} {{ p.stock <= 5 ? '· Stock bajo: no vendible' : '· Disponible para venta' }}
                </div>
                <div *ngIf="!productosFiltrados.length" class="product-search-empty" role="status"><b>No encontramos productos</b><span>Prueba otro nombre o revisa el inventario.</span></div>
              </div>
            </label>
          </div>
          <div class="row product-row">
            <label>Cantidad<input #cantidadInput type="number" min="1" step="1" [(ngModel)]="cantidad"></label>
            <button (click)="agregar()" [disabled]="!productoId">Agregar al carrito</button>
          </div>

          <div class="table-wrap mini">
            <table>
              <thead><tr><th>Producto</th><th>Cant.</th><th>P. unit.</th><th>Subtotal</th><th></th></tr></thead>
              <tbody>
                <tr *ngFor="let d of detalles; let i=index">
                  <td>{{ d.productoNombre }}</td>
                  <td><span class="cart-fixed-quantity" aria-label="Cantidad en carrito">{{d.cantidad}}</span></td>
                  <td>S/ {{ d.precioUnitario | number:'1.2-2' }}</td>
                  <td>S/ {{ d.subtotal | number:'1.2-2' }}</td>
                  <td><button class="link danger-text" (click)="quitar(i)">Quitar</button></td>
                </tr>
                <tr *ngIf="!detalles.length"><td colspan="5" class="empty">Agregue productos para registrar la venta.</td></tr>
              </tbody>
            </table>
          </div>
          <div class="sale-count no-print" *ngIf="detalles.length" aria-live="polite">{{ detalles.length }} artículo(s) diferente(s) · {{ unidadesCarrito }} unidad(es) en el carrito</div>
        </section>
        <section class="sale-step" aria-labelledby="sale-payment-title">
          <h3 class="sale-step-title" id="sale-payment-title"><span aria-hidden="true">03</span> Pago</h3>
          <div class="total animated-sale-total"><span>Total calculado automáticamente</span><strong>S/ {{ totalBorrador | number:'1.2-2' }}</strong></div>
          <fieldset class="payment-picker"><legend>Método de pago previsto</legend><p>Elige cómo pagar. Comprueba el destinatario en tu aplicación bancaria antes de confirmar.</p><div class="payment-methods"><label *ngFor="let m of metodosPago" [class.payment-selected]="metodoPago===m.codigo"><input type="radio" name="metodoPago" [(ngModel)]="metodoPago" [value]="m.codigo" [disabled]="!m.activo"><img class="payment-brand-logo" [src]="m.logo" [alt]="m.nombre"><span>{{m.nombre}}</span><span class="payment-unavailable">{{m.codigo==='TARJETA' ? 'Pendiente de conexión' : 'Verificación manual'}}</span></label></div><small>La venta permanece pendiente hasta verificar el ingreso. Mostrar estos datos no realiza una transferencia.</small><ng-container *ngTemplateOutlet="datosCobro; context: {metodo: metodoPago, importe: totalBorrador}"></ng-container></fieldset>
          <button class="primary-wide workspace-primary" [disabled]="!detalles.length || procesando" (click)="registrar()">
            {{ procesando ? 'Registrando...' : 'Registrar y continuar' }}
          </button>
        </section>
      </section>

      <section class="panel receipt" id="comprobante">
        <div class="comprobante-a4">
          <div class="receipt-head receipt-head-grid">
            <div class="company">
              <img class="receipt-logo" src="/maranatha-logo.png" alt="Maranatha Store"><h2>MARANATHA STORE</h2>
              <div class="company-sub">Librería escolar</div>
              <div class="company-small">Tacna, Perú</div>
              <div class="ruc-line"><span class="ruc-label">RUC</span> <span class="ruc-number">No configurado</span></div>
            </div>
            <div class="comprobante-block">
              <div class="comprobante-type">{{ comprobanteTipo }}</div>
              <div class="serie-number"><span *ngIf="ventaEmitida">{{ ventaEmitida.serie }}-{{ ventaEmitida.numero }}</span><span *ngIf="!ventaEmitida">(BORRADOR)</span></div>
            </div>
          </div>

          <hr>
          <p>
            Fecha: {{ comprobanteFecha | date:'dd/MM/yyyy HH:mm':'-0500' }}<br>
            Estado: {{ ventaEmitida?.estado || 'BORRADOR' }} · Pago: {{ ventaEmitida?.estadoPago || 'PENDIENTE' }}
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

          <div class="receipt-verification" *ngIf="qrComprobante && ventaEmitida"><img [src]="qrComprobante" alt="QR con los datos del comprobante"><small>Escanea para leer el resumen del registro.<br>No valida pago ni emisión SUNAT.</small></div>
          <small>Gracias por su compra</small>
          <div class="receipt-legend">
            <small>Representación impresa del comprobante. Este sistema no está asociado a SUNAT; el documento mostrado no constituye comprobante fiscal validado por SUNAT.</small>
          </div>
        </div>

        <div class="comprobante-ticket">
          <div class="ticket-head"><img class="receipt-logo" src="/maranatha-logo.png" alt="Librería Maranatha">
            <h3>MARANATHA STORE</h3>
            <div class="company-sub">Librería escolar</div>
            <div class="ruc-line"><span class="ruc-label">RUC</span> <span class="ruc-number">No configurado</span></div>
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
            <div class="receipt-verification" *ngIf="qrComprobante && ventaEmitida"><img [src]="qrComprobante" alt="QR con los datos del comprobante"><small>Resumen del registro · no valida pago</small></div>
            <div class="receipt-legend small">Representación impresa. No validado por SUNAT.</div>
          </div>
        </div>
      </section>
    </div>

    <dialog viewportModal (modalDismiss)="ventaAnular=undefined" class="modal product-modal no-print" *ngIf="ventaAnular" role="presentation">
      <section class="dialog inventory-dialog" role="alertdialog" aria-modal="true" aria-labelledby="titulo-anular">
        <span class="product-dialog-eyebrow">ANULACIÓN DE COMPROBANTE</span>
        <h3 id="titulo-anular">¿Anular esta venta?</h3>
        <p>Comprobante <strong>{{ ventaAnular.serie }}-{{ ventaAnular.numero }}</strong></p>
        <p>Su estado cambiará a ANULADA, permanecerá en el historial y se repondrá el stock de los productos vendidos. Esta operación no elimina el registro.</p>
        <div class="actions">
          <button type="button" class="secondary" (click)="ventaAnular=undefined" [disabled]="anulando">Cancelar</button>
          <button type="button" class="danger-button" (click)="confirmarAnulacion()" [disabled]="anulando">{{ anulando ? 'Anulando...' : 'Confirmar anulación' }}</button>
        </div>
      </section>
    </dialog>
    <dialog viewportModal (modalDismiss)="ventaDetalle=undefined" class="modal product-modal no-print" *ngIf="ventaDetalle" role="presentation">
      <section class="dialog inventory-dialog sale-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="titulo-detalle-venta">
        <span class="product-dialog-eyebrow">HISTORIAL DE VENTAS</span>
        <h3 id="titulo-detalle-venta">Detalle del comprobante</h3>
        <p><b>{{ ventaDetalle.serie }}-{{ ventaDetalle.numero }}</b> · {{ ventaDetalle.fecha | date:'dd/MM/yyyy HH:mm' }}</p>
        <p>Cliente: {{ ventaDetalle.clienteNombre }} · Estado: {{ ventaDetalle.estado }}</p>
        <div class="table-wrap mini"><table>
          <thead><tr><th>Artículo</th><th>Cantidad</th><th>Subtotal</th></tr></thead>
          <tbody>
            <tr *ngFor="let d of ventaDetalle.detalles"><td>{{ d.productoNombre || ('ID '+d.productoId) }}</td><td>{{ d.cantidad }}</td><td>S/ {{ d.subtotal | number:'1.2-2' }}</td></tr>
            <tr *ngIf="!ventaDetalle.detalles?.length"><td colspan="3">Sin detalle disponible.</td></tr>
          </tbody>
        </table></div>
        <div class="total"><span>Total</span><strong>S/ {{ ventaDetalle.total | number:'1.2-2' }}</strong></div>
        <div class="actions"><button type="button" (click)="ventaDetalle=undefined">Cerrar</button></div>
      </section>
    </dialog>
    <dialog viewportModal (modalDismiss)="ventaDescargas=undefined" class="modal no-print" *ngIf="ventaDescargas as v" (click)="ventaDescargas=undefined" role="presentation"><section class="dialog receipt-download-dialog" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="download-title"><span class="product-dialog-eyebrow">{{v.serie}}-{{v.numero}}</span><h3 id="download-title">Descargar comprobante</h3><p>Elige un formato. PDF A4 e impresión conservan la misma plantilla.</p><div class="receipt-download-grid"><button (click)="ventaDescargas=undefined; descargarPdf(v)"><b>PDF A4</b><small>Hoja completa, fondo blanco</small></button><button (click)="ventaDescargas=undefined; descargarPdf(v,true)"><b>PDF ticket</b><small>Formato ampliado de 80 mm</small></button><button (click)="ventaDescargas=undefined; descargarJson(v)"><b>JSON interno</b><small>Datos del registro</small></button><button (click)="ventaDescargas=undefined; reimprimir(v)"><b>Imprimir</b><small>Elegir A4 o ticket</small></button><button disabled title="Falta integrar la emisión electrónica con un proveedor fiscal"><b>XML fiscal</b><small>Pendiente de emisión y firma</small></button><button disabled title="Solo puede descargarse una constancia recibida realmente de SUNAT u OSE"><b>CDR</b><small>Pendiente de respuesta fiscal</small></button></div><p class="hint">XML y CDR se habilitarán cuando existan archivos fiscales reales para este comprobante.</p><div class="actions"><button class="secondary" (click)="ventaDescargas=undefined">Cerrar</button></div></section></dialog>
    <dialog viewportModal [modalBusy]="eliminandoVenta" (modalDismiss)="ventaEliminar=undefined" class="modal product-modal no-print" *ngIf="ventaEliminar as v" role="presentation"><section class="dialog inventory-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-sale-title"><span class="product-dialog-eyebrow">REGISTRO INTERNO</span><h3 id="delete-sale-title">¿Eliminar {{v.serie}}-{{v.numero}}?</h3><p>Se eliminará el registro y su detalle. Si la venta está emitida, primero se anulará para reponer las existencias. Una venta ya anulada no repondrá stock otra vez.</p><p>Esta opción no está permitida para comprobantes fiscales o ventas con pago registrado.</p><div class="actions"><button class="secondary" (click)="ventaEliminar=undefined" [disabled]="eliminandoVenta">Cancelar</button><button class="danger-button" (click)="confirmarEliminacionVenta()" [disabled]="eliminandoVenta">{{eliminandoVenta ? 'Eliminando…' : 'Eliminar registro'}}</button></div></section></dialog>
    <section class="panel history no-print">
      <div class="history-title"><div><h3>Comprobantes emitidos</h3><p>La eliminación de registros internos repone el stock una sola vez.</p></div></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Comprobante</th><th>Fecha</th><th>Cliente</th><th>Total</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let v of ventas" [class.sale-row-annulled]="ventaAnimadaId === v.id" [class.sale-row-removing]="ventaEliminadaId === v.id">
              <td><b>{{ v.serie }}-{{ v.numero }}</b><br><small>{{ textoTipo(v.tipoComprobante) }}</small></td>
              <td>{{ v.fecha | date:'dd/MM/yyyy HH:mm' }}</td>
              <td>{{ v.clienteNombre }}</td>
              <td>S/ {{ v.total | number:'1.2-2' }}</td>
              <td><span class="status" [class.danger]="v.estado==='ANULADA'">{{ v.estado }}</span></td>
              <td>
                <button class="link" (click)="abrirDetalleVenta(v)">Ver detalle</button>
                <button class="link" (click)="ventaDescargas=v" [disabled]="exportando">Descargar ▾</button>
                <button *ngIf="auth.isAdmin && !v.validadoSunat && (!v.estadoPago || v.estadoPago==='PENDIENTE')" class="link danger-text trash-eat-button" [class.trash-eating]="ventaEliminadaId===v.id" (click)="ventaEliminar=v" [disabled]="eliminandoVenta" aria-label="Eliminar comprobante interno"><span class="trash-bin" aria-hidden="true"><span class="trash-bin-lid"></span><span class="trash-bin-body"></span></span><span>Eliminar</span></button>
              </td>
            </tr>
            <tr *ngIf="!ventas.length"><td colspan="6" class="empty">Todavía no hay ventas registradas.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  `
})
export class VentasComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly detector = inject(ChangeDetectorRef);
  @ViewChild('cantidadInput') cantidadInput?:ElementRef<HTMLInputElement>;
  private reloj?:ReturnType<typeof setInterval>;horaActual=new Date();
  cerrarBuscador(){setTimeout(()=>{if(!document.activeElement?.closest('.sale-search-label'))this.mostrarBuscador=false;},120);}
  exportando = false;
  pdfPreparado?: {url:string;nombre:string};
  stockBloqueado?: Producto;
  mostrarPago = false;
  metodoPago = '';
  copiaCobro = '';
  async copiarCobro(valor:string){try{await navigator.clipboard.writeText(valor);this.copiaCobro='Dato copiado';}catch{this.copiaCobro='Selecciona el número y cópialo manualmente.';}}
  qrComprobante = '';
  readonly metodosPago = [
    {codigo:'YAPE',nombre:'Yape',logo:'/payments/yape.png',activo:true},
    {codigo:'PLIN',nombre:'Plin → Yape',logo:'/payments/plin.png',activo:true},
    {codigo:'TRANSFERENCIA',nombre:'Transferencia bancaria',logo:'/payments/bcp.ico',activo:true},
    {codigo:'TARJETA',nombre:'Tarjeta',logo:'/payments/visa.png',activo:true}
  ];  productos: Producto[] = [];
  clientes: Cliente[] = [];
  ventas: Venta[] = [];
  ventaAnular?: Venta;
  ventaEliminar?: Venta;
  eliminandoVenta = false;
  ventaEliminadaId?: number;
  ventaDescargas?: Venta;
  ventaDetalle?: Venta;
  ventaAnimadaId?: number;
  anulando = false;
  tipo: TipoComprobante = 'BOLETA';
  clienteId?: number;
  productoId?: number;
  cantidad = 1;
  documento = '';
  clienteConsultado?: Cliente;
  private consultaDocumento?: Subscription;
  private documentoTimer?: ReturnType<typeof setTimeout>;
  mostrarBuscador = false;
  documentoDatos?: DocumentoConsulta;
  documentoNombre = '';
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

  get unidadesCarrito(): number {
    return this.detalles.reduce((cantidad, detalle) => cantidad + detalle.cantidad, 0);
  }

  get totalBorrador(): number {
    return this.detalles.reduce((centavos, detalle) => centavos + Math.round((detalle.subtotal ?? 0) * 100), 0) / 100;
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
      ? this.productos.filter(item => item.nombre.toLowerCase().includes(filtro)).slice(0, 5)
      : [];
  }

  get productoSeleccionadoNombre(): string {
    const producto = this.productos.find(p => p.id === this.productoId);
    return producto ? producto.nombre : 'Ninguno';
  }

  get comprobanteFecha(): Date | string {
    return this.ventaEmitida?.fecha || this.horaActual;
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
    this.reloj=setInterval(()=>this.horaActual=new Date(),1000);
    this.cargarCatalogos();
    this.cargarVentas();
    const pref = localStorage.getItem('maranatha.imprimir.formato');
    if (pref === 'TICKET' || pref === 'A4') this.preferenciaImpresion = pref as 'TICKET'|'A4';
  }

  onTipoChange(): void {
    this.ventaEmitida = undefined;
    clearTimeout(this.documentoTimer); this.consultaDocumento?.unsubscribe(); this.clienteConsultado = undefined; this.clienteId = undefined; this.documentoBuscando = false;
    this.documento = '';
    this.documentoNombre = '';
    this.documentoError = '';
    this.documentoDatos = undefined; this.documentoValido = false;
  }

  ngOnDestroy(): void { clearInterval(this.reloj); clearTimeout(this.documentoTimer); this.consultaDocumento?.unsubscribe(); this.cerrarPdf(); }
  onDocumentoChange(): void {
    clearTimeout(this.documentoTimer); this.consultaDocumento?.unsubscribe();
    this.documentoNombre = ''; this.documentoError = ''; this.documentoDatos = undefined; this.documentoValido = false; this.documentoBuscando = false;
    this.clienteConsultado = undefined; this.clienteId = undefined; this.ventaEmitida = undefined;
    const longitud = this.tipo === 'BOLETA' ? 8 : this.tipo === 'FACTURA' ? 11 : 0;
    if (longitud && new RegExp('^[0-9]{' + longitud + '}$').test(this.documento.trim())) this.documentoTimer = setTimeout(() => this.buscarDocumento(), 600);
  }
  onClienteSeleccionado(): void {
    clearTimeout(this.documentoTimer); this.consultaDocumento?.unsubscribe(); this.clienteConsultado = undefined;
    this.ventaEmitida = undefined; this.documentoDatos = undefined; this.documentoValido = false; this.documentoBuscando = false; this.documentoError = '';
    const cliente = this.clientes.find(c => c.id === this.clienteId);
    this.documento = cliente?.numeroDocumento || ''; this.documentoNombre = cliente ? (cliente.nombre + ' ' + (cliente.apellido || '')).trim() : '';
  }

  onProductoFiltroChange(): void {
    this.productoId = undefined; this.mostrarBuscador = true;
  }

  seleccionarProducto(id?: number): void {
    const producto = this.productos.find(p => p.id === id);
    if (!producto) return;
    if (producto.stock <= 5) { this.productoId = undefined; this.stockBloqueado = producto; return; }
    if (this.disponible(producto) < 1) { this.mostrarErrorSimple('Ya agregó todas las unidades disponibles al carrito.'); return; }
    this.productoId = id; this.mostrarBuscador = false; this.stockBloqueado = undefined;
    this.mensaje = '';
    this.productoFiltro = producto.nombre;
    this.cantidadInput?.nativeElement.focus();
  }

  buscarDocumento(): void {
    clearTimeout(this.documentoTimer);
    if (this.documentoBuscando || this.documentoValido) return;
    const numero = this.documento.trim(), tipo = this.tipo;
    if (!new RegExp(tipo === 'BOLETA' ? '^[0-9]{8}$' : '^[0-9]{11}$').test(numero)) { this.documentoError = 'Ingrese un documento con la cantidad correcta de dígitos.'; return; }
    this.documentoBuscando = true; this.documentoError = '';
    const consulta = tipo === 'BOLETA' ? this.api.buscarDni(numero) : this.api.buscarRuc(numero);
    this.consultaDocumento = consulta.subscribe({
      next: data => {
        if (this.documento.trim() !== numero || this.tipo !== tipo) return;
        this.documentoDatos = data; this.documentoBuscando = false; this.documentoValido = true; this.documentoNombre = data.nombre;
        const existente = this.clientes.find(c => c.numeroDocumento === numero && c.tipoDocumento === data.tipoDocumento);
        if (existente) { this.clienteId = existente.id; this.clienteConsultado = undefined; }
        else { this.clienteId = undefined; this.clienteConsultado = { nombre: data.tipoDocumento === 'DNI' ? data.nombres! : data.nombre, apellido: data.tipoDocumento === 'DNI' ? [data.apellidoPaterno, data.apellidoMaterno].filter(Boolean).join(' ') : null, tipoDocumento: data.tipoDocumento, numeroDocumento: numero, direccion: data.direccion || null, activo: true }; }
      },
      error: error => { if (this.documento.trim() !== numero || this.tipo !== tipo) return; this.documentoBuscando = false; this.documentoDatos = undefined; this.documentoValido = false; this.clienteConsultado = undefined; this.documentoError = error.error?.message || (error.status === 404 ? 'La consulta no está disponible. Verifique que el backend actualizado esté iniciado.' : 'No se pudo consultar el documento. Intente más tarde.'); }
    });
  }

  cargarCatalogos(): void {
    forkJoin([this.api.productos(), this.api.clientes()]).subscribe({
      next: ([productos, clientes]) => {
        this.productos = productos.filter(item => item.activo !== false);
        this.clientes = clientes.filter(item => item.activo !== false);
        if (!this.productos.some(item => item.id === this.productoId)) {
          this.productoId = undefined;
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
    if (producto.stock <= 5) { this.stockBloqueado = producto; return; }
    const existente = this.detalles.find(item => item.productoId === producto.id);
    const cantidadTotal = cantidad + (existente?.cantidad || 0);
    if (cantidadTotal > producto.stock) {
      this.mostrarErrorSimple(`Stock insuficiente. Solo hay ${producto.stock} unidades disponibles.`);
      return;
    }

    if (existente) {
      existente.cantidad = cantidadTotal;
      existente.subtotal = cantidadTotal * Math.round((existente.precioUnitario ?? 0) * 100) / 100;
    } else {
      this.detalles.push({
        productoId: producto.id!,
        productoNombre: producto.nombre,
        cantidad,
        precioUnitario: producto.precio,
        subtotal: Math.round(producto.precio * 100) * cantidad / 100
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
    if (!this.detalles.length || this.procesando) return;
    if (this.documentoBuscando) { this.mostrarErrorSimple('Espere a que termine la consulta del documento.'); return; }
    if (this.documento && !this.clienteId && !this.documentoValido) { this.mostrarErrorSimple('Consulte y confirme el documento antes de registrar la venta.'); return; }

    this.procesando = true;
    this.mensaje = '';
    const resolverCliente: Observable<Cliente | undefined> = this.clienteConsultado && !this.clienteId ? this.api.crearCliente(this.clienteConsultado) : of(undefined);
    resolverCliente.pipe(switchMap(cliente => {
      if (cliente) { this.clienteId = cliente.id; this.clientes.push(cliente); this.clienteConsultado = undefined; }
      return this.api.crearVenta({
      clienteId: this.clienteId,
      tipoComprobante: this.tipo,
      metodoPago: this.metodoPago || undefined,
      detalles: this.detalles.map(item => ({ productoId: item.productoId, cantidad: item.cantidad }))
      });
    })).subscribe({
      next: venta => {
        this.procesando = false;
        this.ventaEmitida = venta;
        void this.actualizarQr(venta);
        this.detalles = [];
        this.mensaje = `Venta registrada: ${venta.serie}-${venta.numero}. El stock fue actualizado.`;
        this.esError = false;
        this.cargarCatalogos();
        this.cargarVentas();
        this.mostrarPago = true;
      },
      error: error => {
        this.procesando = false;
        this.mostrarError(error, 'No se pudo registrar la venta.');
      }
    });
  }

  abrirDetalleVenta(venta: Venta): void {
    this.api.obtenerVenta(venta.id).subscribe({
      next: detalle => this.ventaDetalle = detalle,
      error: error => this.mostrarError(error, 'No se pudo consultar el detalle del comprobante.')
    });
  }

  anular(venta: Venta): void {
    this.ventaAnular = venta;
  }

  confirmarAnulacion(): void {
    const venta = this.ventaAnular;
    if (!venta || this.anulando) return;
    this.anulando = true;
    this.api.anularVenta(venta.id).subscribe({
      next: anulada => {
        this.ventaAnular = undefined;
        this.ventaEmitida = anulada;
        this.ventaAnimadaId = anulada.id;
        this.ventas = this.ventas.map(v => v.id === anulada.id ? anulada : v);
        this.mensaje = `Venta ${anulada.serie}-${anulada.numero} anulada. Historial conservado y stock repuesto.`;
        this.esError = false;
        this.anulando = false;
        this.cargarCatalogos();
        setTimeout(() => { this.ventaAnimadaId = undefined; this.cargarVentas(); }, 700);
      },
      error: error => { this.anulando = false; this.mostrarError(error, 'No se pudo anular la venta.'); }
    });
  }

  confirmarEliminacionVenta(): void {
    const venta=this.ventaEliminar;if(!venta || this.eliminandoVenta || !this.auth.isAdmin)return;
    this.eliminandoVenta=true;
    const anularPrimero=venta.estado==='EMITIDA'?this.api.anularVenta(venta.id):of(venta);
    anularPrimero.pipe(switchMap(()=>this.api.eliminarVenta(venta.id))).subscribe({
      next:()=>{this.ventaEliminar=undefined;this.ventaEliminadaId=venta.id;this.eliminandoVenta=false;this.esError=false;this.mensaje='Registro interno eliminado. El stock se repuso durante su anulación.';if(this.ventaEmitida?.id===venta.id)this.ventaEmitida=undefined;this.cargarCatalogos();setTimeout(()=>{this.ventas=this.ventas.filter(v=>v.id!==venta.id);this.ventaEliminadaId=undefined;},650);},
      error:e=>{this.eliminandoVenta=false;this.ventaEliminar=undefined;this.cargarVentas();this.cargarCatalogos();this.mostrarError(e,'No se completó la eliminación. Revise el estado de la venta.');}
    });
  }

  reimprimir(venta: Venta): void {
    this.ventaEmitida = venta;
    this.abrirDialogoImpresion();
  }

  nuevoComprobante(): void {
    this.ventaEmitida = undefined;
    this.qrComprobante = '';
    this.detalles = [];
    this.tipo = 'BOLETA';
    this.onTipoChange();
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
    if (this.usarSiempreImpresion) { this.preferenciaImpresion = formato; localStorage.setItem('maranatha.imprimir.formato', formato); }
    if (this.ventaEmitida) void this.descargarPdf(this.ventaEmitida, formato === 'TICKET', true);
  }

  limpiarPreferenciaImpresion(): void {
    localStorage.removeItem('maranatha.imprimir.formato');
    this.preferenciaImpresion = undefined;
    this.mensaje = 'Preferencia de impresión eliminada.';
    this.esError = false;
  }

  disponible(p: Producto): number {
    return Math.max(0, p.stock - (this.detalles.find(d => d.productoId === p.id)?.cantidad || 0));
  }
  get alternativas(): Producto[] {
    return this.productos.filter(p => p.stock > 5 && this.disponible(p) > 0 && p.id !== this.stockBloqueado?.id).slice(0, 5);
  }
  cambiarCantidad(indice: number, valor: number): void {
    const d = this.detalles[indice], p = this.productos.find(p => p.id === d.productoId);
    if (!p || !Number.isInteger(Number(valor)) || valor < 1 || valor > p.stock || p.stock <= 5) {
      this.mostrarErrorSimple('Cantidad inválida o stock insuficiente.'); return;
    }
    d.cantidad = Number(valor); d.subtotal = Math.round(d.cantidad * (d.precioUnitario || 0) * 100) / 100;
    this.ventaEmitida = undefined;
  }
  descargarJson(venta: Venta): void {
    this.api.obtenerVenta(venta.id).subscribe({ next: v => {
      const url = URL.createObjectURL(new Blob([JSON.stringify({ tipo: 'REGISTRO_INTERNO_NO_FISCAL', venta: v }, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'venta-' + v.serie + '-' + v.numero + '.json'; a.click(); URL.revokeObjectURL(url);
    }, error: e => this.mostrarError(e, 'No se pudo descargar la venta.') });
  }
  async descargarPdf(venta: Venta, ticket = false, imprimir = false): Promise<void> {
    if (this.exportando) return;
    const printWindow = imprimir ? window.open('', '_blank') : null;
    if (imprimir && !printWindow) { this.mostrarErrorSimple('Permita abrir la ventana de impresión para continuar.'); return; }
    if (printWindow) printWindow.opener = null;
    this.exportando = true;
    try {
      const { firstValueFrom } = await import('rxjs');
      this.ventaEmitida = await firstValueFrom(this.api.obtenerVenta(venta.id));
      this.qrComprobante = await createReceiptQr(this.ventaEmitida);
      this.detector.detectChanges();
      const source = document.querySelector<HTMLElement>('#comprobante ' + (ticket ? '.comprobante-ticket' : '.comprobante-a4'));
      if (!source) throw new Error('No se encontró la plantilla del comprobante');
      const { exportReceipt } = await import('../core/receipt-export');
      const blob = await exportReceipt(source, ticket, printWindow || undefined);
      if (blob) {
        this.cerrarPdf();
        this.pdfPreparado = {url:URL.createObjectURL(blob),nombre:'comprobante-' + venta.serie + '-' + venta.numero + (ticket ? '-ticket-80mm' : '-A4') + '.pdf'};
      }
    } catch {
      printWindow?.close();this.mostrarErrorSimple('No se pudo preparar el comprobante. Verifique la conexión y el logo.');
    } finally { this.exportando = false; }
  }

  cerrarPdf(): void { if (this.pdfPreparado) URL.revokeObjectURL(this.pdfPreparado.url); this.pdfPreparado = undefined; }

  private async actualizarQr(venta: Venta): Promise<void> {
    this.qrComprobante = '';
    try { const qr = await createReceiptQr(venta); if (this.ventaEmitida?.id === venta.id) this.qrComprobante = qr; }
    catch { this.mostrarErrorSimple('La venta se registró, pero no se pudo generar el QR. Intenta descargar nuevamente.'); }
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
