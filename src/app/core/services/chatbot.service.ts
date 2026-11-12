import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

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

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/chatbot';

  status(): Observable<WhatsappStatus> {
    return this.http.get<WhatsappStatus>(`${this.base}/whatsapp/status`).pipe(
      // fallback mock
    );
  }

  refreshQr(): Observable<WhatsappStatus> {
    return this.http.post<WhatsappStatus>(`${this.base}/whatsapp/qr`, {});
  }

  logs(): Observable<ChatLog[]> {
    return this.http.get<ChatLog[]>(`${this.base}/logs`);
  }

  metrics(): Observable<ChatMetrics> {
    return this.http.get<ChatMetrics>(`${this.base}/metrics`);
  }
}
