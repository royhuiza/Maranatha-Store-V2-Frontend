import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ChatLog {
  id: number;
  fecha: string;
  canal: 'web' | 'whatsapp';
  pregunta: string;
  respuesta: string;
  estado: 'ok' | 'error' | 'pendiente';
  conversacion: { from: 'user' | 'bot'; text: string; fecha: string }[];
}

export interface WhatsappStatus {
  connected: boolean;
  qr: string | null;
}

export interface ChatMetrics {
  total: number;
  webPct: number;
  whatsappPct: number;
}

/** Entrada que devuelve el microservicio de chat (ms-chat). */
interface ChatLogEntry {
  fecha: string;
  origen: string;
  direccion: string;
  mensaje: string;
  estado: string;
}

/** Respuesta del QR de WhatsApp (ms-chat -> Evolution API). */
interface ChatQrResponse {
  instancia?: string;
  base64?: string;
  estado?: string;
}

/**
 * Cliente del microservicio de chat.
 *
 * Rutas reales en el Gateway: /api/v1/chat/** -> ms-chat.
 *  - GET /api/v1/chat/whatsapp/qr  -> QR de WhatsApp (base64) y estado
 *  - GET /api/v1/chat/logs          -> bitacora reciente de la actividad
 */
@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/v1/chat`;

  /** Estado de la conexion de WhatsApp y QR para escanear (data URI o null). */
  status(): Observable<WhatsappStatus> {
    return this.http.get<ChatQrResponse>(`${this.base}/whatsapp/qr`).pipe(
      catchError(() => of(null)),
      map(respuesta => this.aEstado(respuesta))
    );
  }

  /** Fuerza una nueva consulta del QR al microservicio. */
  refreshQr(): Observable<WhatsappStatus> {
    return this.status();
  }

  /** Bitacora reciente del chatbot (canal web o whatsapp). */
  logs(): Observable<ChatLog[]> {
    return this.http.get<ChatLogEntry[]>(`${this.base}/logs`).pipe(
      catchError(() => of([] as ChatLogEntry[])),
      map(entradas => (entradas ?? []).map((entrada, indice) => this.aRegistro(entrada, indice)))
    );
  }

  /** Metricas calculadas a partir de la bitacora disponible. */
  metrics(): Observable<ChatMetrics> {
    return this.logs().pipe(
      map(registros => {
        const total = registros.length;
        const whatsapp = registros.filter(registro => registro.canal === 'whatsapp').length;
        const web = total - whatsapp;
        return {
          total,
          webPct: total ? Math.round((web / total) * 100) : 0,
          whatsappPct: total ? Math.round((whatsapp / total) * 100) : 0
        };
      })
    );
  }

  private aEstado(respuesta: ChatQrResponse | null): WhatsappStatus {
    const base64 = (respuesta?.base64 ?? '').trim();
    const estado = (respuesta?.estado ?? '').toLowerCase();
    return {
      connected: estado === 'connected' || estado === 'autenticado',
      // Evolution API ya entrega el PNG como data URI; si llega en base64 puro
      // se le antepone el prefijo para que el <img> lo pueda pintar.
      qr: base64
        ? (base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`)
        : null
    };
  }

  private aRegistro(entrada: ChatLogEntry, indice: number): ChatLog {
    // El backend registra: origen (app|whatsapp|sistema), direccion
    // (entrada|salida|qr) y estado (procesado|enviado|error|rechazado).
    const canal: ChatLog['canal'] = entrada.origen === 'whatsapp' ? 'whatsapp' : 'web';
    const esEntrada = entrada.direccion === 'entrada';
    const esSalida = entrada.direccion === 'salida';
    return {
      id: indice + 1,
      fecha: entrada.fecha,
      canal,
      pregunta: esEntrada ? entrada.mensaje : '',
      respuesta: esSalida ? entrada.mensaje : '',
      estado: entrada.estado === 'error' || entrada.estado === 'rechazado' ? 'error' : 'ok',
      conversacion: []
    };
  }
}
