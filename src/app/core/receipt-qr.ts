import { Venta } from '../models';

/** A local, readable snapshot; no public endpoint or external QR service receives customer data. */
export function receiptQrText(venta: Venta): string {
  const money = (value: number) => Number(value).toFixed(2);
  const total = Number(venta.total);
  const base = Math.round(total / 1.18 * 100) / 100;
  const header = [
    'MARANATHA STORE · REGISTRO INTERNO',
    `${venta.tipoComprobante} ${venta.serie}-${venta.numero}`,
    `Fecha: ${venta.fecha.replace('T', ' ').slice(0, 16)}`,
    `Cliente: ${venta.clienteNombre.slice(0, 100)}`,
    `Estado: ${venta.estado}`,
    `Base: PEN ${money(base)} | IGV: PEN ${money(total - base)}`,
    `TOTAL: PEN ${money(total)}`
  ];
  const details = venta.detalles.map(d => `${d.cantidad} x ${d.productoNombre || 'Producto ' + d.productoId}: PEN ${money(Number(d.subtotal))}`);
  const full = [...header, ...details, 'Comprobante interno.'].join('\n');
  return new TextEncoder().encode(full).length <= 1500 ? full
    : [...header, `${venta.detalles.length} articulos; detalle completo en el comprobante.`, 'Comprobante interno.'].join('\n');
}

export async function createReceiptQr(venta: Venta): Promise<string> {
  const { toDataURL } = await import('qrcode');
  return toDataURL(receiptQrText(venta), { width: 640, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
}
