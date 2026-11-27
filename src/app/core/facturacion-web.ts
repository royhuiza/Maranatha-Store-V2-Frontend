import { jsPDF } from 'jspdf';

import { toDataURL } from 'qrcode';

import { Venta } from '../models/venta';



export type FormatoWeb = 'TICKET' | 'A4';

export interface EstadoWeb { ventaId: number; serie: string; numero: string; estadoSunat: string; etiqueta: string; ambiente: string; validezFiscalConfirmada: boolean; }

export interface LocalWeb { ambiente: string; validezFiscal: boolean; serie: string; numero: string; gravado: number; exonerado: number; inafecto: number; igv: number; total: number; contenidoQr?: string; }

export interface BetaWeb { ambiente: string; validezFiscal: boolean; comprobante: string; estadoSunat: string; codigo: string; igv: string; total: string; fecha: string; contenidoQr: string; subtotal?: string; cliente?: string; detalles?: { descripcion: string; cantidad: string; precioUnitario: string; importe: string }[]; }

export const monedaWeb = (n: unknown): string => n == null || n === '' || !Number.isFinite(Number(n)) ? 'No disponible' : 'S/ ' + Number(n).toFixed(2);

export function localCoincide(v: Venta, l: LocalWeb): boolean {

  return ['BORRADOR_LOCAL', 'FIRMADO_LOCAL'].includes(l.ambiente) && l.validezFiscal === false && l.serie === v.serie && l.numero === v.numero && Number.isFinite(l.total) && Math.round(l.total * 100) === Math.round(v.total * 100) && [l.gravado, l.exonerado, l.inafecto, l.igv].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0) && Math.round((l.gravado + l.exonerado + l.inafecto + l.igv) * 100) === Math.round(l.total * 100);

}

// Evidencia de laboratorio: no acredita identidad fiscal del comprador.

export function qrLocalCoincide(v: Venta, l?: LocalWeb): boolean {

  if (!l || !localCoincide(v, l) || l.ambiente !== 'FIRMADO_LOCAL' || v.estado !== 'EMITIDA') return false;

  if (v.tipoComprobante !== 'BOLETA' && v.tipoComprobante !== 'FACTURA') return false;

  const factura = v.tipoComprobante === 'FACTURA';

  const c = typeof l.contenidoQr === 'string' ? l.contenidoQr.split('|') : [];

  return c.length === 10 && c[0] === '20123456786' &&

    c[1] === (factura ? '01' : '03') && c[2] === (factura ? 'F001' : 'B001') &&

    c[2] === v.serie && c[3] === v.numero &&

    /^\d+.\d{2}$/.test(c[4]) && /^\d+.\d{2}$/.test(c[5]) &&

    Number(c[4]) === l.igv && Number(c[5]) === l.total &&

    c[6] === String(v.fecha || '').slice(0, 10) &&

    c[7] === (factura ? '6' : '1') && c[8] === (factura ? '20123456786' : '00000000') &&

    /^[A-Za-z0-9+/]{43}=$/.test(c[9]);

}

export function betaCoincide(b: BetaWeb, n: string): boolean {

  const c = typeof b.contenidoQr === 'string' ? b.contenidoQr.split('|') : [];

  return b.ambiente === 'BETA' && b.validezFiscal === false && ['F9B1-' + n, 'B9B1-' + n].includes(b.comprobante) && b.estadoSunat === 'ACEPTADO_BETA' && String(b.codigo) === '0' && c.length === 10 && /^\d{11}$/.test(c[0]) && c[1] === (b.comprobante.startsWith('B9B1-') ? '03' : '01') && c[2] + '-' + c[3] === b.comprobante && c[6] === b.fecha && !!c[9].trim() && Number.isFinite(Number(b.igv)) && Number.isFinite(Number(b.total)) && Number(c[4]) === Number(b.igv) && Number(c[5]) === Number(b.total);

}

export async function qrWeb(texto?: string): Promise<string> { return texto ? toDataURL(texto, { width: 320, margin: 4, errorCorrectionLevel: 'M' }) : ''; }

export function desgloseVenta(v: Venta): { gravado: number; exonerado: number; inafecto: number; igv: number } | undefined {

  if (v.tipoComprobante === 'NOTA_PEDIDO' || !v.detalles?.length) return undefined;

  let gravado = 0, exonerado = 0, inafecto = 0, igv = 0;

  for (const d of v.detalles) {

    const tipo = (d as typeof d & { afectacionIgv?: string }).afectacionIgv;

    if (d.subtotal == null || !Number.isFinite(d.subtotal) || d.subtotal < 0) return undefined;

    const cents = Math.round(d.subtotal * 100);

    if (tipo === 'GRAVADO') { const base = Math.round(cents / 1.18); gravado += base; igv += cents - base; }

    else if (tipo === 'EXONERADO') exonerado += cents; else if (tipo === 'INAFECTO') inafecto += cents; else return undefined;

  }

  if (gravado + exonerado + inafecto + igv !== Math.round(v.total * 100)) return undefined;

  return { gravado: gravado / 100, exonerado: exonerado / 100, inafecto: inafecto / 100, igv: igv / 100 };

}

export function referenciaQrWeb(v: Venta): string { return `MARANATHA|REGISTRO INTERNO|${v.serie}-${v.numero}`; }

interface Fila { nombre: string; cantidad: string; precio: string; importe: string; }

interface Documento { compradorLocalNombre?: string; compradorLocalDocumento?: string; referencia: string; empresa: string; emisor: string; tipo: string; cliente: string; documento: string; fecha: string; estado: string; filas: Fila[]; impuestos: string[]; total: string; aviso: string; etiquetaQr: string; qr?: string; beta: boolean; }

export function etiquetaEstadoWeb(codigo?: string): string {

  const etiquetas: Record<string, string> = { NO_APLICA: 'No aplica', PENDIENTE: 'Pendiente', EN_PROCESO: 'En proceso', ACEPTADO_BETA: 'Aceptado en Beta', OBSERVADO_BETA: 'Observado en Beta', RECHAZADO_BETA: 'Rechazado en Beta', ACEPTADO: 'Aceptado registrado (sin confirmación fiscal)', OBSERVADO: 'Observado registrado', RECHAZADO: 'Rechazado registrado', ERROR_COMUNICACION: 'Error de comunicación', REQUIERE_REVISION: 'Requiere revisión' };

  return etiquetas[codigo || ''] || 'Sin registro fiscal';

}

function docVenta(v: Venta, estado: string, l?: LocalWeb, qr?: string): Documento {

  const datos = l && localCoincide(v, l) ? l : desgloseVenta(v);

  const impuestos = v.tipoComprobante === 'NOTA_PEDIDO' ? ['Tributos: no aplica'] : datos ? ['Gravado ' + monedaWeb(datos.gravado), 'Exonerado ' + monedaWeb(datos.exonerado), 'Inafecto ' + monedaWeb(datos.inafecto), 'IGV ' + monedaWeb(datos.igv)] : ['Desglose tributario no disponible'];

  return { compradorLocalNombre: v.compradorLocalNombre, compradorLocalDocumento: v.compradorLocalDocumento, referencia: `${v.serie}-${v.numero}`, empresa: '', emisor: 'Datos fiscales del emisor pendientes', tipo: v.tipoComprobante.replace(/_/g, ' ') + ' / REGISTRO INTERNO', cliente: v.clienteNombre || 'Comprador no identificado', documento: v.clienteDocumento || '', fecha: String(v.fecha || 'No disponible').replace('T', ' ').slice(0, 19), estado, filas: (v.detalles || []).map(d => ({ nombre: d.productoNombre || `Producto ${d.productoId}`, cantidad: String(d.cantidad), precio: monedaWeb(d.precioUnitario), importe: monedaWeb(d.subtotal) })), impuestos, total: monedaWeb(v.total), aviso: 'REGISTRO INTERNO - NO ACREDITA VALIDACIÓN SUNAT', etiquetaQr: qrLocalCoincide(v, l) ? 'QR de prueba local - identidades ficticias - sin validez fiscal' : 'QR de referencia interna', qr, beta: false };

}

function docBeta(b: BetaWeb, qr: string, v?: Venta): Documento {

  const campos = b.contenidoQr.split('|');

  if (!betaCoincide(b, campos[3] || '')) throw Error('Evidencia Beta inconsistente');

  return { compradorLocalNombre: v?.compradorLocalNombre, compradorLocalDocumento: v?.compradorLocalDocumento, referencia: b.comprobante, empresa: 'MARANATHA BETA - PRUEBA', emisor: 'RUC de laboratorio: ' + campos[0], tipo: b.comprobante.startsWith('B9B1-') ? 'BOLETA DE PRUEBA' : 'FACTURA DE PRUEBA', cliente: b.cliente || 'Cliente de laboratorio', documento: 'RUC: ' + campos[8], fecha: b.fecha, estado: 'Aceptado en Beta · Código ' + b.codigo, filas: (b.detalles || []).map(d => ({ nombre: d.descripcion, cantidad: String(d.cantidad), precio: monedaWeb(d.precioUnitario), importe: monedaWeb(d.importe) })), impuestos: ['Subtotal ' + monedaWeb(b.subtotal), 'IGV ' + monedaWeb(b.igv)], total: monedaWeb(b.total), aviso: 'COMPROBANTE DE PRUEBA - SIN VALIDEZ FISCAL', etiquetaQr: 'QR del XML firmado · Beta', qr, beta: true };

}

function pdfDocumento(doc: Documento, formato: FormatoWeb): File {

  const ticket = formato === 'TICKET', ancho = ticket ? 80 : 210, m = ticket ? 4.2 : 14, w = ancho - 2 * m;

  // Measure and render with the same font metrics. A4 paginates; Ticket grows with content.

  const measure = new jsPDF({ unit: 'mm', format: 'a4' });

  function layout(pdf: jsPDF, draw: boolean, alto: number): number {

    let y = m; const limit = alto - m;

    function room(h: number) { if (!ticket && y + h > limit) { if (draw) pdf.addPage('a4'); y = m; } }

    function text(s: string, size = 10, bold = false, align: 'left' | 'center' | 'right' = 'left', width = w) {

      pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size);

      const lines = pdf.splitTextToSize(s, width) as string[], step = size * 0.352778 * 1.23;

      for (const line of lines) { room(step); if (draw) pdf.text(line, align === 'center' ? ancho / 2 : align === 'right' ? ancho - m : m, y + size * 0.352778, { align }); y += step; }

    }

    function gap(n: number) { y += n; }

    function rule() { room(2); if (draw) { pdf.setDrawColor(90); pdf.setLineWidth(.2); pdf.line(m, y, ancho - m, y); } gap(2); }

    text('MARANATHA STORE', ticket ? 15 : 21, true, 'center');

    if (doc.empresa) text(doc.empresa, ticket ? 9 : 11, false, 'center');

    text(doc.emisor, ticket ? 9 : 11, false, 'center'); gap(ticket ? 3 : 6);

    const top = y; text(doc.tipo, ticket ? 12 : 12, true, 'center'); text(doc.referencia, ticket ? 12 : 11, ticket, 'center'); gap(2);

    if (!ticket && draw) { pdf.setDrawColor(30); pdf.rect(m, top - 1, w, y - top + 1); }

    if (!ticket) { gap(5); const t = y; text(doc.aviso, 9, true, 'center'); gap(1); if (draw) pdf.rect(m, t - 1, w, y - t + 1); }

    gap(3); if (doc.compradorLocalNombre) { text('Comprador local (no fiscal): ' + doc.compradorLocalNombre); if (doc.compradorLocalDocumento) text(doc.compradorLocalDocumento); gap(2); } text((doc.beta ? 'Receptor fiscal de prueba: ' : 'Cliente: ') + doc.cliente, ticket ? 10 : 11); if (doc.documento) text(doc.documento, ticket ? 10 : 11); text('Fecha: ' + doc.fecha, ticket ? 10 : 11); text((ticket ? '' : 'Estado: ') + doc.estado, ticket ? 10 : 11); gap(3);

    if (ticket) { text('PRODUCTOS', 10, true); gap(1); for (const f of doc.filas) { text(f.nombre, 10); text(f.cantidad + ' × ' + f.precio + '     ' + f.importe, 10); gap(2); } }

    else {

      const cols = [w * .55, w * .12, w * .16, w * .17], xs = [m, m + cols[0], m + cols[0] + cols[1], m + cols[0] + cols[1] + cols[2]];

      function header() { room(8); if (draw) { pdf.setFillColor(235, 237, 239); pdf.rect(m, y, w, 7, 'F'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10);['Producto', 'Cant.', 'Precio', 'Importe'].forEach((s, i) => pdf.text(s, i ? xs[i] + cols[i] - 1 : xs[i] + 1, y + 4.6, { align: i ? 'right' : 'left' })); } y += 8; }

      header(); for (const f of doc.filas) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); const cells = [f.nombre, f.cantidad, f.precio.replace('S/ ', ''), f.importe.replace('S/ ', '')].map((s, i) => pdf.splitTextToSize(s, cols[i] - 2) as string[]); const count = Math.max(...cells.map(c => c.length)); for (let k = 0; k < count; k++) { if (y + 5 > limit) { if (draw) pdf.addPage('a4'); y = m; header(); } if (draw) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); cells.forEach((c, i) => { if (c[k]) pdf.text(c[k], i ? xs[i] + cols[i] - 1 : xs[i] + 1, y + 3.8, { align: i ? 'right' : 'left' }); }); } y += 5; } if (draw) { pdf.setDrawColor(190); pdf.line(m, y, ancho - m, y); } gap(1); }

    }

    if (!doc.filas.length) text('Detalle no disponible'); gap(2); if (!ticket) rule();

    for (const impuesto of doc.impuestos) text(impuesto, ticket ? 10 : 11, false, ticket ? 'left' : 'right'); gap(2);

    text('TOTAL ' + doc.total, ticket ? 15 : 20, true, ticket ? 'center' : 'right'); gap(ticket ? 3 : 9);

    if (doc.qr) { const q = ticket ? 38 : 35; room(q + 15); if (draw) pdf.addImage(doc.qr, 'PNG', (ancho - q) / 2, y, q, q); gap(q + 2); text(doc.etiquetaQr, 9, ticket, 'center'); }

    gap(3); if (!ticket) rule(); text(doc.aviso, ticket ? 9 : 8, ticket, 'center'); gap(2); return y + m;

  }

  const alto = ticket ? Math.max(90, Math.ceil(layout(measure, false, 14000))) : 297;

  if (alto > 4900) throw Error('Ticket demasiado largo; utiliza A4');

  const pdf = new jsPDF({ unit: 'mm', format: ticket ? [80, alto] : 'a4', orientation: 'portrait', compress: true });

  pdf.setProperties({ title: 'Maranatha Store - ' + doc.referencia, author: 'Maranatha Store' }); layout(pdf, true, alto);

  return new File([pdf.output('blob')], `Maranatha-${doc.referencia.replace(/[^a-zA-Z0-9_-]/g, '_')}-${formato}.pdf`, { type: 'application/pdf' });

}

export async function pdfVentaWeb(v: Venta, formato: FormatoWeb, estado: string, local?: LocalWeb): Promise<File> { const contenido = qrLocalCoincide(v, local) ? local!.contenidoQr : referenciaQrWeb(v); const qr = await qrWeb(contenido).catch(() => undefined); return pdfDocumento(docVenta(v, estado, local, qr), formato); }

export function pdfBetaWeb(b: BetaWeb, qr: string, formato: FormatoWeb, v?: Venta): File { return pdfDocumento(docBeta(b, qr, v), formato); }

export function descargarWeb(archivo: File): void { const url = URL.createObjectURL(archivo), a = document.createElement('a'); a.href = url; a.download = archivo.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }

export function vistaWeb(archivo: File, popup: Window): void { const url = URL.createObjectURL(archivo); popup.location.replace(url); setTimeout(() => URL.revokeObjectURL(url), 600000); }

export function betaIntegradaCoincide(v: Venta, b: BetaWeb, r: { ventaId: number; serieComercial: string; numeroComercial: string; serie: string; numero: string; tipoComprobante: string; fechaEmision: string; estadoSunat: string; codigo: string | null; ambiente: string; validezFiscal: boolean; aceptado: boolean; estadoVenta: string; igv: number; total: number }): boolean {
  const factura = v.tipoComprobante === 'FACTURA';
  const c = b.contenidoQr?.split('|') || [];
  const d = desgloseVenta(v);
  return !!d && v.estado === 'EMITIDA' && ['BOLETA', 'FACTURA'].includes(v.tipoComprobante) &&
    r.ventaId === v.id && r.serieComercial === v.serie && r.numeroComercial === v.numero &&
    r.ambiente === 'BETA' && r.validezFiscal === false && r.aceptado === true &&
    r.estadoSunat === 'ACEPTADO_BETA' && r.codigo === '0' && r.estadoVenta === 'EMITIDA' &&
    r.serie === (factura ? 'F9B1' : 'B9B1') && /^[0-9]{8}$/.test(r.numero) &&
    r.tipoComprobante === (factura ? '01' : '03') && betaCoincide(b, r.numero) &&
    b.comprobante === `${r.serie}-${r.numero}` && b.fecha === r.fechaEmision &&
    b.fecha === String(v.fecha).slice(0, 10) && c[0] === '20123456786' &&
    c[7] === '6' && c[8] === '20123456786' && /^[A-Za-z0-9+/]{43}=$/.test(c[9]) &&
    Number(b.total) === v.total && Number(r.total) === v.total &&
    Number(b.igv) === d.igv && Number(r.igv) === d.igv;
}
