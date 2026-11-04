import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatbotService, ChatLog, WhatsappStatus, ChatMetrics } from '../core/services/chatbot.service';

@Component({
  standalone: true,
  selector: 'app-chatbot-logs',
  imports: [CommonModule],
  template: `
    <div class="page-title"><div><h2>Logs del Chatbot</h2><p>Actividad del bot y conexión de WhatsApp</p></div></div>

    <section class="wa-panel">
      <div class="wa-header">
        <h3>WhatsApp</h3>
        <span class="badge" [class.ok]="status()?.connected" [class.off]="!status()?.connected">
          {{ status()?.connected ? 'Conectado' : 'Desconectado' }}
        </span>
      </div>
      <div class="qr-card" *ngIf="!status()?.connected">
        <img *ngIf="status()?.qr" [src]="status()?.qr" alt="QR WhatsApp" />
        <p *ngIf="!status()?.qr">Sin QR disponible</p>
        <button (click)="refreshQr()">Actualizar QR</button>
      </div>
    </section>

    <section class="metrics">
      <article class="metric-card"><h4>Total de Consultas</h4><div class="value">{{ metrics()?.total ?? 0 }}</div></article>
      <article class="metric-card"><h4>Interacciones Web</h4><div class="value">{{ metrics()?.webPct ?? 0 }}%</div></article>
      <article class="metric-card"><h4>Interacciones WhatsApp</h4><div class="value">{{ metrics()?.whatsappPct ?? 0 }}%</div></article>
    </section>

    <section class="table-wrap">
      <table>
        <thead><tr><th>Fecha/Hora</th><th>Canal</th><th>Pregunta</th><th>Respuesta</th><th>Estado</th></tr></thead>
        <tbody>
          <tr *ngFor="let l of logs()" (click)="open(l)" class="row">
            <td>{{ l.fecha | date:'short' }}</td>
            <td><span class="chan" [class.web]="l.canal==='web'" [class.wa]="l.canal==='whatsapp'">{{ l.canal }}</span></td>
            <td>{{ l.pregunta }}</td>
            <td>{{ l.respuesta }}</td>
            <td><span class="est" [class.ok]="l.estado==='ok'" [class.err]="l.estado==='error'">{{ l.estado }}</span></td>
          </tr>
        </tbody>
      </table>
    </section>

    <div class="modal" *ngIf="selected()" (click)="close()">
      <div class="modal-body" (click)="$event.stopPropagation()">
        <h3>Conversación</h3>
        <div class="chat">
          <div *ngFor="let m of selected()!.conversacion" class="msg" [class.user]="m.from==='user'" [class.bot]="m.from==='bot'">
            <div class="bubble">{{ m.text }}</div>
          </div>
        </div>
        <button (click)="close()">Cerrar</button>
      </div>
    </div>
  `,
  styles: [`
    .wa-panel{background:#fff;border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .wa-header{display:flex;justify-content:space-between;align-items:center}
    .badge{padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600}
    .badge.ok{background:#dcfce7;color:#166534}
    .badge.off{background:#fee2e2;color:#991b1b}
    .qr-card{text-align:center;margin-top:12px}
    .qr-card img{max-width:200px}
    .metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
    .metric-card{background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .value{font-size:28px;font-weight:700}
    .table-wrap{background:#fff;border-radius:12px;padding:8px;overflow:auto}
    table{width:100%;border-collapse:collapse}
    th,td{padding:8px;border-bottom:1px solid #eee;text-align:left}
    .row{cursor:pointer}
    .chan{padding:2px 8px;border-radius:6px;font-size:12px}
    .chan.web{background:#dbeafe;color:#1e40af}
    .chan.wa{background:#dcfce7;color:#166534}
    .est.ok{color:#16a34a}
    .est.err{color:#dc2626}
    .modal{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000}
    .modal-body{background:#fff;border-radius:12px;padding:16px;max-width:480px;width:90%;max-height:80vh;overflow:auto}
    .chat{display:flex;flex-direction:column;gap:8px;margin:12px 0}
    .msg.user{align-self:flex-end}
    .msg.bot{align-self:flex-start}
    .bubble{padding:8px 12px;border-radius:12px;max-width:80%}
    .msg.user .bubble{background:#2563eb;color:#fff}
    .msg.bot .bubble{background:#f1f5f9}
  `]
})
export class ChatbotLogsComponent {
  private readonly svc = inject(ChatbotService);
  status = signal<WhatsappStatus | null>(null);
  logs = signal<ChatLog[]>([]);
  metrics = signal<ChatMetrics | null>(null);
  selected = signal<ChatLog | null>(null);

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.svc.status().subscribe(s => this.status.set(s));
    this.svc.logs().subscribe(l => this.logs.set(l));
    this.svc.metrics().subscribe(m => this.metrics.set(m));
  }

  refreshQr(): void {
    this.svc.refreshQr().subscribe(s => this.status.set(s));
  }

  open(l: ChatLog): void { this.selected.set(l); }
  close(): void { this.selected.set(null); }
}
