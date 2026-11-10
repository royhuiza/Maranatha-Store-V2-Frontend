import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, forkJoin, of, switchMap } from 'rxjs';
import { ViewportModalDirective } from '../core/viewport-modal.directive';
import { createReceiptQr } from '../core/receipt-qr';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ApiError, Cliente, DetalleVenta, HistorialVentas, Producto, TipoComprobante, Venta } from '../models';

type AnimacionHistorial = 'next' | 'prev' | 'filtro' | 'tamano';

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

    <dialog viewportModal (modalDismiss)="stockBloqueado=undefined" class="modal no-print" *ngIf="stockBloqueado" role="alertdialog" aria-modal="true" aria-label="Sin stock"><section class="dialog stock-warning"><h3>Sin stock: producto no disponible para venta</h3><p>{{ stockBloqueado.nombre }} no tiene unidades disponibles. Puede elegir otro producto:</p><h4>Alternativas disponibles</h4><button class="secondary" *ngFor="let p of alternativas" (click)="stockBloqueado=undefined; seleccionarProducto(p.id)">{{ p.nombre }} · {{ disponible(p) }} disponibles</button><p *ngIf="!alternativas.length">No hay alternativas con stock disponible.</p><button (click)="stockBloqueado=undefined">Cerrar</button></section></dialog>
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
                <option [ngValue]="undefined">Público general</option>
                <option *ngFor="let c of clientes" [ngValue]="c.id">{{ c.nombre }} {{ c.apellido }} · {{ c.numeroDocumento || 'sin documento' }}</option>
              </select>
            </label>
          </div>
          <div *ngIf="tipo==='BOLETA' || tipo==='FACTURA'" class="row documento-row" [class.documento-relleno]="documentoAnimado">
            <label>{{ tipo === 'BOLETA' ? 'DNI' : 'RUC' }}
              <input type="text" inputmode="numeric" [(ngModel)]="documento" name="documento" (ngModelChange)="onDocumentoChange()" [attr.maxlength]="tipo === 'BOLETA' ? 8 : 11" placeholder="{{ tipo === 'BOLETA' ? 'Ingrese DNI (8 dígitos)' : 'Ingrese RUC (11 dígitos)' }}">
            </label>
          </div>
          <small class="error documento-error" *ngIf="documentoError">{{ documentoError }}</small>
          <small class="warning" *ngIf="tipo==='FACTURA'">La factura exige un cliente con RUC válido de 11 dígitos.</small>

        </section>
        <section class="sale-step" aria-labelledby="sale-products-title">
          <h3 class="sale-step-title" id="sale-products-title"><span aria-hidden="true">02</span> Productos</h3>
          <div class="sale-help-banner no-print"><span aria-hidden="true">✦</span><div><b>Arma tu venta paso a paso</b><p>Busca el primer artículo, elige una cantidad y pulsa Agregar al carrito. Repite con otro producto; el total se actualizará solo.</p></div></div>
          <div class="row product-row product-search-row">
            <label class="sale-search-label">Producto
              <div class="sale-search-control"><input type="text" [(ngModel)]="productoFiltro" (ngModelChange)="onProductoFiltroChange()" placeholder="Buscar por nombre o letra" autocomplete="off" (focus)="mostrarBuscador=!productoId" (blur)="cerrarBuscador()" (keydown.escape)="mostrarBuscador=false" aria-label="Buscar producto" aria-controls="selector-productos" [attr.aria-expanded]="mostrarBuscador"><button class="sale-search-button" type="button" (click)="mostrarBuscador=!mostrarBuscador" aria-label="Mostrar productos coincidentes"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M15.5 15.5 21 21"></path></svg></button></div>
              <div id="selector-productos" class="suggestions product-selector" *ngIf="mostrarBuscador && productoFiltro.trim()" aria-label="Hasta cinco productos coincidentes">
                <div *ngFor="let p of productosFiltrados" class="suggestion" [class.selected]="productoId === p.id" [class.disabled]="p.stock<=0" (mousedown)="$event.preventDefault()" (click)="seleccionarProducto(p.id)" role="button" tabindex="0" (keydown.enter)="seleccionarProducto(p.id)">
                  {{ p.nombre }} — S/ {{ p.precio | number:'1.2-2' }} — disponible {{ disponible(p) }} {{ p.stock <= 0 ? '· Sin stock: no vendible' : p.stock <= (p.stockMinimo ?? 5) ? '· Stock bajo' : '· Disponible para venta' }}
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
        <section class="sale-step" aria-labelledby="sale-total-title">
          <h3 class="sale-step-title" id="sale-total-title"><span aria-hidden="true">03</span> Total</h3>
          <div class="total animated-sale-total"><span>Total calculado automáticamente</span><strong>S/ {{ totalBorrador | number:'1.2-2' }}</strong></div>
          <button class="primary-wide workspace-primary" [disabled]="!detalles.length || procesando" (click)="registrar()">
            {{ procesando ? 'Registrando...' : 'Registrar venta' }}
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

          <div class="receipt-verification" *ngIf="qrComprobante && ventaEmitida"><img [src]="qrComprobante" alt="QR con los datos del comprobante"><small>Escanea para leer el resumen del registro.</small></div>
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
            <div class="receipt-verification" *ngIf="qrComprobante && ventaEmitida"><img [src]="qrComprobante" alt="QR con los datos del comprobante"><small>Resumen del registro</small></div>
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
    <dialog viewportModal (modalDismiss)="ventaDescargas=undefined" class="modal no-print" *ngIf="ventaDescargas as v" (click)="ventaDescargas=undefined" role="presentation"><section class="dialog receipt-download-dialog" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="download-title"><span class="product-dialog-eyebrow">{{v.serie}}-{{v.numero}}</span><h3 id="download-title">Descargar comprobante</h3><p>Elige un formato. PDF A4 e impresión conservan la misma plantilla.</p><div class="receipt-download-grid"><button (click)="ventaDescargas=undefined; descargarPdf(v)"><b>PDF A4</b><small>Hoja completa, fondo blanco</small></button><button (click)="ventaDescargas=undefined; descargarPdf(v,true)"><b>PDF ticket</b><small>Formato ampliado de 80 mm</small></button><button (click)="ventaDescargas=undefined; descargarJson(v)"><b>JSON interno</b><small>Datos del registro</small></button><button (click)="ventaDescargas=undefined; reimprimir(v)"><b>Imprimir</b><small>Elegir A4 o ticket</small></button></div><div class="actions"><button class="secondary" (click)="ventaDescargas=undefined">Cerrar</button></div></section></dialog>
    <dialog viewportModal [modalBusy]="eliminandoVenta" (modalDismiss)="ventaEliminar=undefined" class="modal product-modal no-print" *ngIf="ventaEliminar as v" role="presentation"><section class="dialog inventory-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-sale-title"><span class="product-dialog-eyebrow">REGISTRO INTERNO</span><h3 id="delete-sale-title">¿Eliminar {{v.serie}}-{{v.numero}}?</h3><p>Se eliminará el registro y su detalle. Si la venta está emitida, primero se anulará para reponer las existencias. Una venta ya anulada no repondrá stock otra vez.</p><div class="actions"><button class="secondary" (click)="ventaEliminar=undefined" [disabled]="eliminandoVenta">Cancelar</button><button class="danger-button" (click)="confirmarEliminacionVenta()" [disabled]="eliminandoVenta">{{eliminandoVenta ? 'Eliminando…' : 'Eliminar registro'}}</button></div></section></dialog>
    <section class="panel history no-print">
      <div class="history-title"><div><h3>Historial de ventas</h3><p>Filtra por fecha y número de comprobante.</p></div></div>
      <form class="history-filters" (submit)="$event.preventDefault()" aria-label="Filtros del historial de ventas">
        <label>Desde<input type="date" [(ngModel)]="filtroDesde" (ngModelChange)="filtrar()" name="filtroDesde" [max]="filtroHasta || null"></label>
        <label>Hasta<input type="date" [(ngModel)]="filtroHasta" (ngModelChange)="filtrar()" name="filtroHasta" [min]="filtroDesde || null"></label>
        <label>N.° de comprobante<input type="search" [(ngModel)]="filtroNumero" (ngModelChange)="filtrar(true)" name="filtroNumero" placeholder="Ej.: B001-00000012 o 12" autocomplete="off"></label>
        <button type="button" class="secondary" (click)="limpiarFiltros()" [disabled]="!hayFiltros">Limpiar</button>
      </form>
      <p class="history-count" aria-live="polite"><ng-container *ngFor="let k of [claveAnimacion]"><span class="history-count-value">{{ historial?.totalElementos ?? 0 }} de {{ historial?.totalVentas ?? 0 }} venta(s) · Total filtrado S/ {{ totalFiltrado | number:'1.2-2' }}</span></ng-container><span *ngIf="cargandoHistorial" class="history-loading-text"> · Cargando…</span></p>
      <div class="table-wrap history-table" [class.history-busy]="cargandoHistorial" [attr.aria-busy]="cargandoHistorial">
        <div class="history-progress" *ngIf="cargandoHistorial" aria-hidden="true"></div>
        <table>
          <thead><tr><th>Comprobante</th><th>Fecha</th><th>Cliente</th><th>Total</th><th>Estado</th><th></th></tr></thead>
          <tbody [ngClass]="'hist-' + (animacionHistorial || 'filtro')">
            <tr *ngFor="let v of ventasFiltradas; let i = index" [style.--fila]="i" [class.sale-row-annulled]="ventaAnimadaId === v.id" [class.sale-row-removing]="ventaEliminadaId === v.id">
              <td><b>{{ v.serie }}-{{ v.numero }}</b><br><small>{{ textoTipo(v.tipoComprobante) }}</small></td>
              <td>{{ v.fecha | date:'dd/MM/yyyy HH:mm' }}</td>
              <td>{{ v.clienteNombre }}<br><small *ngIf="v.clienteDocumento">{{ v.clienteDocumento }}</small></td>
              <td>S/ {{ v.total | number:'1.2-2' }}</td>
              <td><span class="status" [class.danger]="v.estado==='ANULADA'">{{ v.estado }}</span></td>
              <td>
                <button class="link" (click)="abrirDetalleVenta(v)">Ver detalle</button>
                <button class="link" (click)="ventaDescargas=v" [disabled]="exportando">Comprobante ▾</button>
                <button *ngIf="auth.isAdmin" class="link danger-text trash-eat-button" [class.trash-eating]="ventaEliminadaId===v.id" (click)="ventaEliminar=v" [disabled]="eliminandoVenta" aria-label="Eliminar comprobante interno"><span class="trash-bin" aria-hidden="true"><span class="trash-bin-lid"></span><span class="trash-bin-body"></span></span><span>Eliminar</span></button>
              </td>
            </tr>
            <tr *ngIf="!ventasFiltradas.length && !cargandoHistorial"><td colspan="6" class="empty">{{ historial?.totalVentas ? 'Ninguna venta coincide con los filtros.' : 'Todavía no hay ventas registradas.' }}</td></tr>
          </tbody>
        </table>
      </div>
      <nav class="history-pager" *ngIf="historial && historial.totalElementos > 0" aria-label="Paginación del historial">
        <button type="button" class="secondary" (click)="irPagina(paginaHistorial - 1, 'prev')" [disabled]="paginaHistorial === 0 || cargandoHistorial">‹ Anterior</button>
        <span class="pager-label"><ng-container *ngFor="let k of [claveAnimacion]"><b class="pager-page" [ngClass]="'hist-' + (animacionHistorial || 'filtro')">Página {{ paginaHistorial + 1 }}</b></ng-container> de {{ historial.totalPaginas }}</span>
        <button type="button" class="secondary" (click)="irPagina(paginaHistorial + 1, 'next')" [disabled]="paginaHistorial + 1 >= historial.totalPaginas || cargandoHistorial">Siguiente ›</button>
        <label>Mostrar
          <select [(ngModel)]="tamanoHistorial" (ngModelChange)="irPagina(0, 'tamano')" name="tamanoHistorial">
            <option [ngValue]="10">10</option><option [ngValue]="20">20</option><option [ngValue]="50">50</option>
          </select>
        </label>
      </nav>
    </section>
  `,
  styles: [`
    .history-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) auto;gap:12px;align-items:end;margin:4px 0 10px;animation:filtrosEntrada .45s cubic-bezier(.2,.8,.2,1) both}
    .history-filters label{display:grid;gap:6px;font-size:12px;font-weight:600}
    .history-filters button{height:40px}
    .history-count{margin:0 0 10px;font-size:12px;opacity:.75}
    .history-pager{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:10px;margin-top:12px;font-size:12px;animation:filtrosEntrada .35s ease both}
    .history-pager button{height:34px;padding:0 14px;transition:transform .18s ease,box-shadow .18s ease,opacity .2s}
    .history-pager button:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 4px 12px #1e493218}
    .history-pager button:not(:disabled):active{transform:scale(.96)}
    .history-pager select{transition:box-shadow .2s}
    .history-pager select:focus{box-shadow:0 0 0 3px #40867a33}
    .pager-label{display:inline-flex;gap:4px;align-items:baseline}
    .pager-page{display:inline-block;font-weight:700}
    .pager-page.hist-next{animation:paginaNext .32s cubic-bezier(.2,.8,.2,1) both}
    .pager-page.hist-prev{animation:paginaPrev .32s cubic-bezier(.2,.8,.2,1) both}
    .pager-page.hist-filtro,.pager-page.hist-tamano{animation:conteoPop .35s ease both}
    .history-count-value{display:inline-block;animation:conteoPop .35s ease both}
    .history-loading-text{animation:parpadeo 1s ease-in-out infinite}
    .history-table{position:relative;transition:opacity .2s ease,filter .2s ease}
    .history-table.history-busy{opacity:.55;filter:saturate(.7)}
    .history-progress{position:absolute;top:0;left:0;right:0;height:3px;z-index:2;overflow:hidden;border-radius:3px}
    .history-progress::after{content:'';position:absolute;top:0;bottom:0;width:35%;background:linear-gradient(90deg,transparent,#40867a,#d6a264,transparent);animation:barraCarga 1s ease-in-out infinite}
    tbody.hist-next tr:not(.sale-row-annulled):not(.sale-row-removing){animation:filaNext .38s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--fila,0) * 30ms)}
    tbody.hist-prev tr:not(.sale-row-annulled):not(.sale-row-removing){animation:filaPrev .38s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--fila,0) * 30ms)}
    tbody.hist-filtro tr:not(.sale-row-annulled):not(.sale-row-removing){animation:filaFiltro .34s ease both;animation-delay:calc(var(--fila,0) * 28ms)}
    tbody.hist-tamano tr:not(.sale-row-annulled):not(.sale-row-removing){animation:filaTamano .36s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--fila,0) * 18ms)}
    @keyframes filaNext{from{opacity:0;transform:translateX(26px)}to{opacity:1;transform:none}}
    @keyframes filaPrev{from{opacity:0;transform:translateX(-26px)}to{opacity:1;transform:none}}
    @keyframes filaFiltro{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    @keyframes filaTamano{from{opacity:0;transform:scaleY(.6);transform-origin:top}to{opacity:1;transform:none}}
    @keyframes paginaNext{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:none}}
    @keyframes paginaPrev{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
    @keyframes conteoPop{0%{opacity:0;transform:translateY(4px)}60%{opacity:1;transform:translateY(-1px)}100%{opacity:1;transform:none}}
    @keyframes parpadeo{50%{opacity:.35}}
    @keyframes barraCarga{from{left:-35%}to{left:100%}}
    @media(prefers-reduced-motion:reduce){.history-pager,.history-pager button,.pager-page,.history-count-value,.history-loading-text,.history-progress::after,tbody[class*="hist-"] tr{animation:none!important;transition:none!important}}
    .history-pager label{display:flex;align-items:center;gap:6px;font-weight:600}
    .history-pager select{height:34px;width:auto}
    @keyframes filtrosEntrada{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    @media (max-width:900px){.history-filters{grid-template-columns:1fr 1fr}}
    .documento-row{animation:documentoEntrada .45s cubic-bezier(.2,.8,.2,1) both}
    .documento-row input{transition:border-color .35s ease,box-shadow .35s ease,background-color .35s ease}
    .documento-row.documento-relleno input{animation:documentoRelleno .9s ease both}
    .documento-error{display:block;animation:documentoEntrada .3s ease both}
    @keyframes documentoEntrada{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
    @keyframes documentoRelleno{0%{background-color:#e3f3ea;box-shadow:0 0 0 0 rgba(46,139,98,.45)}60%{box-shadow:0 0 0 6px rgba(46,139,98,0)}100%{background-color:transparent;box-shadow:none}}
    @media (prefers-reduced-motion:reduce){.history-filters,.documento-row,.documento-row.documento-relleno input,.documento-error{animation:none}}
  `]
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
  qrComprobante = '';
  filtroDesde = '';
  filtroHasta = '';
  filtroNumero = '';
  productos: Producto[] = [];
  clientes: Cliente[] = [];
  /** Ventas de la página actual del historial (T67/T69: filtradas y paginadas en el backend). */
  ventas: Venta[] = [];
  historial?: HistorialVentas;
  paginaHistorial = 0;
  tamanoHistorial = 10;
  cargandoHistorial = false;
  /** Animación de entrada del historial: siguiente/anterior página, filtro o cambio de tamaño. */
  animacionHistorial: AnimacionHistorial | '' = '';
  private animacionPendiente: AnimacionHistorial = 'filtro';
  claveAnimacion = 0;
  private esperaFiltro?: ReturnType<typeof setTimeout>;
  private historialSub?: Subscription;
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
  mostrarBuscador = false;
  documento = '';
  documentoError = '';
  documentoAnimado = false;
  private temporizadorDocumento?: ReturnType<typeof setTimeout>;
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

  /** T65/T67: el filtro por fechas y número lo aplica el backend; aquí solo está la página actual. */
  get ventasFiltradas(): Venta[] {
    return this.ventas;
  }

  /** Suma de todas las ventas filtradas (no solo de esta página), sin las anuladas. */
  get totalFiltrado(): number {
    return Number(this.historial?.totalMonto ?? 0);
  }

  /** Espera a que el usuario termine de escribir el número antes de consultar. */
  filtrar(escribiendo = false): void {
    if (this.filtroDesde && this.filtroHasta && this.filtroDesde > this.filtroHasta) return;
    clearTimeout(this.esperaFiltro);
    this.esperaFiltro = setTimeout(() => this.irPagina(0, 'filtro'), escribiendo ? 350 : 0);
  }

  /** Cambia de página; el origen decide la animación de entrada de las filas. */
  irPagina(pagina: number, origen: AnimacionHistorial = 'filtro'): void {
    this.animacionPendiente = origen;
    this.paginaHistorial = Math.max(0, pagina);
    this.cargarVentas();
  }

  get hayFiltros(): boolean {
    return !!(this.filtroDesde || this.filtroHasta || this.filtroNumero);
  }

  limpiarFiltros(): void {
    this.filtroDesde = ''; this.filtroHasta = ''; this.filtroNumero = '';
    this.filtrar();
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
    this.clienteId = undefined;
    this.documento = '';
    this.documentoError = '';
  }

  ngOnDestroy(): void { clearInterval(this.reloj); clearTimeout(this.temporizadorDocumento); clearTimeout(this.esperaFiltro); this.historialSub?.unsubscribe(); this.cerrarPdf(); }

  /** Al elegir un cliente se completa su DNI/RUC registrado en el módulo Clientes. */
  onClienteSeleccionado(): void {
    this.ventaEmitida = undefined;
    const cliente = this.clientes.find(c => c.id === this.clienteId);
    this.documento = cliente?.numeroDocumento || '';
    this.documentoError = this.validarDocumento();
    this.animarDocumento();
  }

  /** Reinicia la animación del bloque DNI/RUC cada vez que se completa con un cliente. */
  private animarDocumento(): void {
    clearTimeout(this.temporizadorDocumento);
    this.documentoAnimado = false;
    if (!this.documento) return;
    setTimeout(() => {
      this.documentoAnimado = true;
      this.temporizadorDocumento = setTimeout(() => this.documentoAnimado = false, 950);
    });
  }

  /** Al escribir un DNI/RUC se busca entre los clientes registrados (sin servicios externos). */
  onDocumentoChange(): void {
    this.ventaEmitida = undefined;
    this.documento = (this.documento || '').replace(/\D/g, '');
    const cliente = this.documento ? this.clientes.find(c => c.numeroDocumento === this.documento) : undefined;
    this.clienteId = cliente?.id;
    this.documentoError = this.validarDocumento();
  }

  private validarDocumento(): string {
    const doc = this.documento.trim();
    if (!doc) return '';
    if (this.tipo === 'BOLETA' && !/^\d{8}$/.test(doc)) return 'El DNI debe tener 8 dígitos.';
    if (this.tipo === 'FACTURA' && !/^\d{11}$/.test(doc)) return 'El RUC debe tener 11 dígitos.';
    return '';
  }

  onProductoFiltroChange(): void {
    this.productoId = undefined; this.mostrarBuscador = true;
  }

  seleccionarProducto(id?: number): void {
    const producto = this.productos.find(p => p.id === id);
    if (!producto) return;
    if (producto.stock <= 0) { this.productoId = undefined; this.mostrarBuscador = false; this.stockBloqueado = producto; return; }
    if (this.disponible(producto) < 1) { this.mostrarErrorSimple('Ya agregó todas las unidades disponibles al carrito.'); return; }
    this.productoId = id; this.mostrarBuscador = false; this.stockBloqueado = undefined;
    this.mensaje = '';
    this.productoFiltro = producto.nombre;
    this.cantidadInput?.nativeElement.focus();
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
    this.historialSub?.unsubscribe();
    this.cargandoHistorial = true;
    this.historialSub = this.api.historialVentas({
      desde: this.filtroDesde, hasta: this.filtroHasta, numero: this.filtroNumero,
      pagina: this.paginaHistorial, tamano: this.tamanoHistorial
    }).subscribe({
      next: historial => {
        this.cargandoHistorial = false;
        // Si se eliminó la última venta de la página, se vuelve a la anterior.
        if (!historial.contenido.length && this.paginaHistorial > 0) { this.irPagina(historial.totalPaginas - 1, 'prev'); return; }
        this.animacionHistorial = this.animacionPendiente;
        this.animacionPendiente = 'filtro';
        this.claveAnimacion++;
        this.historial = historial;
        this.ventas = historial.contenido;
      },
      error: error => { this.cargandoHistorial = false; this.mostrarError(error, 'No se pudo cargar el historial de ventas.'); }
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
    if (producto.stock <= 0) { this.stockBloqueado = producto; return; }
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
    this.documentoError = this.validarDocumento();
    if (this.documentoError) { this.mostrarErrorSimple(this.documentoError); return; }

    this.procesando = true;
    this.mensaje = '';
    this.api.crearVenta({
      clienteId: this.clienteId,
      tipoComprobante: this.tipo,
      documento: this.clienteId ? undefined : (this.documento.trim() || undefined),
      detalles: this.detalles.map(item => ({ productoId: item.productoId, cantidad: item.cantidad }))
    }).subscribe({
      next: venta => {
        this.procesando = false;
        this.ventaEmitida = venta;
        this.detalles = [];
        this.documento = '';
        this.mensaje = `Venta registrada: ${venta.serie}-${venta.numero}. El stock fue actualizado.`;
        this.esError = false;
        void this.actualizarQr(venta);
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
      next:()=>{this.ventaEliminar=undefined;this.ventaEliminadaId=venta.id;this.eliminandoVenta=false;this.esError=false;this.mensaje='Registro interno eliminado. El stock se repuso durante su anulación.';if(this.ventaEmitida?.id===venta.id)this.ventaEmitida=undefined;this.cargarCatalogos();setTimeout(()=>{this.ventaEliminadaId=undefined;this.cargarVentas();},650);},
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
    // Primero los productos que comparten la primera palabra (p. ej. otros "Cuaderno"), luego el resto con stock.
    const clave = (this.stockBloqueado?.nombre || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
    const parecido = (p: Producto) => clave && p.nombre.toLowerCase().startsWith(clave) ? 0 : 1;
    return this.productos.filter(p => p.stock > 0 && this.disponible(p) > 0 && p.id !== this.stockBloqueado?.id)
      .sort((a, b) => parecido(a) - parecido(b)).slice(0, 5);
  }
  cambiarCantidad(indice: number, valor: number): void {
    const d = this.detalles[indice], p = this.productos.find(p => p.id === d.productoId);
    if (!p || !Number.isInteger(Number(valor)) || valor < 1 || valor > p.stock || p.stock <= 0) {
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
