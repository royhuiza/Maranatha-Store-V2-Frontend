import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatbotService, ChatLog, WhatsappStatus, ChatMetrics } from '../core/services/chatbot.service';

@Component({
  standalone: true,
  selector: 'app-chatbot-logs',
  imports: [CommonModule],
  template: `
    <div class="page-title"><div><h2>Chatbot</h2><p>Actividad del bot y conexión de WhatsApp</p></div></div>

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
        <button type="button" (click)="refreshQr()">Actualizar QR</button>
      </div>
    </section>

    <section class="metrics">
      <article class="metric-card"><h4>Total de Consultas</h4><div class="value">{{ metrics()?.total ?? 0 }}</div></article>
      <article class="metric-card"><h4>Interacciones Web</h4><div class="value">{{ metrics()?.webPct ?? 0 }}%</div></article>
      <article class="metric-card"><h4>Interacciones WhatsApp</h4><div class="value">{{ metrics()?.whatsappPct ?? 0 }}%</div></article>
    </section>

    <section class="table-wrap">
      <table class="logs-table">
        <colgroup>
          <col style="width:160px">
          <col style="width:100px">
          <col style="width:30%">
          <col style="width:auto">
          <col style="width:90px">
        </colgroup>
        <thead>
          <tr>
            <th>FECHA/HORA</th>
            <th>CANAL</th>
            <th>PREGUNTA</th>
            <th>RESPUESTA</th>
            <th>ESTADO</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let l of paginatedLogs" (click)="open(l)" class="data-row">
            <td class="cell-nowrap">{{ l.fecha | date:'short' }}</td>
            <td><span class="chan" [class.web]="l.canal==='web'" [class.wa]="l.canal==='whatsapp'">{{ l.canal }}</span></td>
            <td class="cell-ellipsis">{{ l.pregunta || '—' }}</td>
            <td class="cell-ellipsis">{{ l.respuesta || '—' }}</td>
            <td><span class="est" [class.ok]="l.estado==='ok'" [class.err]="l.estado==='error'">{{ l.estado }}</span></td>
          </tr>
          <tr *ngIf="!paginatedLogs.length">
            <td colspan="5" class="empty-cell">Sin registros.</td>
          </tr>
        </tbody>
      </table>
      <div class="pagination" *ngIf="logs().length">
        <button type="button" class="page-btn" (click)="prevPage()" [disabled]="currentPage === 1">Anterior</button>
        <span class="page-info">Página {{ currentPage }} de {{ totalPages }}</span>
        <button type="button" class="page-btn" (click)="nextPage()" [disabled]="currentPage === totalPages">Siguiente</button>
      </div>
    </section>

    <div class="modal" *ngIf="selectedLog" (click)="close()">
      <div class="modal-body" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div>
            <h3>Conversación</h3>
            <p class="modal-meta">{{ selectedLog.fecha | date:'medium' }}</p>
          </div>
          <span class="chan" [class.web]="selectedLog.canal==='web'" [class.wa]="selectedLog.canal==='whatsapp'">{{ selectedLog.canal }}</span>
        </div>
        <div class="chat">
          <div class="msg user">
            <div class="bubble">{{ selectedLog.pregunta || '—' }}</div>
          </div>
          <div class="msg bot">
            <div class="bubble">
              <ng-container *ngFor="let line of responseLines(selectedLog.respuesta); let last = last">
                <ng-container *ngFor="let seg of boldSegments(line)">
                  <strong *ngIf="seg.bold">{{ seg.text }}</strong><ng-container *ngIf="!seg.bold">{{ seg.text }}</ng-container>
                </ng-container>
                <br *ngIf="!last">
              </ng-container>
              <span *ngIf="!selectedLog.respuesta">—</span>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" (click)="close()">Cerrar</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .wa-panel{background:#fff;border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .wa-header{display:flex;justify-content:space-between;align-items:center}
    .badge{padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600}
    .badge.ok{background:#dcfce7;color:#166534}
    .badge.off{background:#fee2e2;color:#991b1b}
    .qr-card{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;margin-top:12px}
    .qr-card img{max-width:200px;display:block}
    .metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
    .metric-card{background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .value{font-size:28px;font-weight:700}
    .table-wrap{background:#fff;border-radius:12px;padding:8px;overflow:auto}
    .logs-table{width:100%;table-layout:fixed;border-collapse:collapse}
    .logs-table th,.logs-table td{padding:10px 8px;border-bottom:1px solid #eee;text-align:left;vertical-align:middle}
    .logs-table th{font-size:12px;font-weight:700;color:#475569;letter-spacing:.02em;white-space:nowrap}
    .data-row{cursor:pointer}
    .data-row:hover{background:#f8fafc}
    .cell-nowrap{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cell-ellipsis{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .empty-cell{padding:16px;color:#64748b;text-align:center}
    .chan{display:inline-block;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:600;text-transform:capitalize}
    .chan.web{background:#dbeafe;color:#1e40af}
    .chan.wa{background:#dcfce7;color:#166534}
    .est{font-weight:600;text-transform:capitalize}
    .est.ok{color:#16a34a}
    .est.err{color:#dc2626}
    .pagination{display:flex;align-items:center;justify-content:flex-end;gap:12px;padding:12px 4px 4px}
    .page-btn{padding:6px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#1e293b;cursor:pointer;font-weight:500}
    .page-btn:hover:not(:disabled){background:#f8fafc}
    .page-btn:disabled{opacity:.5;cursor:not-allowed;color:#94a3b8;background:#f1f5f9}
    .page-info{font-size:13px;color:#475569}
    .modal{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px}
    .modal-body{background:#fff;border-radius:12px;padding:16px;max-width:560px;width:100%;max-height:80vh;overflow:auto}
    .modal-header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px}
    .modal-header h3{margin:0}
    .modal-meta{margin:4px 0 0;color:#64748b;font-size:13px}
    .chat{display:flex;flex-direction:column;gap:10px;margin:12px 0}
    .msg{display:flex}
    .msg.user{justify-content:flex-end}
    .msg.bot{justify-content:flex-start}
    .bubble{padding:10px 14px;border-radius:14px;max-width:85%;line-height:1.45;white-space:normal;word-break:break-word}
    .msg.user .bubble{background:#2563eb;color:#fff;border-bottom-right-radius:4px}
    .msg.bot .bubble{background:#f1f5f9;color:#0f172a;border-bottom-left-radius:4px}
    .modal-actions{display:flex;justify-content:flex-end}
    .modal-actions button{padding:8px 14px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;cursor:pointer}
  `]
})
export class ChatbotLogsComponent {
  private readonly svc = inject(ChatbotService);
  status = signal<WhatsappStatus | null>(null);
  logs = signal<ChatLog[]>([]);
  metrics = signal<ChatMetrics | null>(null);
  selectedLog: ChatLog | null = null;

  pageSize = 10;
  currentPage = 1;

  constructor() {
    this.refresh();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.logs().length / this.pageSize));
  }

  get pagedLogs(): ChatLog[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.logs().slice(start, start + this.pageSize);
  }

  get paginatedLogs(): ChatLog[] {
    return this.pagedLogs;
  }

  refresh(): void {
    this.svc.status().subscribe(s => this.status.set(s));
    this.svc.logs().subscribe(l => {
      this.logs.set(l);
      this.currentPage = Math.min(this.currentPage, Math.max(1, Math.ceil(l.length / this.pageSize)));
    });
    this.svc.metrics().subscribe(m => this.metrics.set(m));
  }

  refreshQr(): void {
    this.svc.refreshQr().subscribe(s => this.status.set(s));
  }

  open(l: ChatLog): void { this.selectedLog = l; }
  close(): void { this.selectedLog = null; }

  prevPage(): void { if (this.currentPage > 1) this.currentPage--; }
  nextPage(): void { if (this.currentPage < this.totalPages) this.currentPage++; }

  responseLines(text: string | null | undefined): string[] {
    return (text ?? '').split('\n');
  }

  boldSegments(text: string): { text: string; bold: boolean }[] {
    const segments: { text: string; bold: boolean }[] = [];
    const re = /\*\*(.+?)\*\*/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      if (match.index > last) segments.push({ text: text.slice(last, match.index), bold: false });
      segments.push({ text: match[1], bold: true });
      last = re.lastIndex;
    }
    if (last < text.length) segments.push({ text: text.slice(last), bold: false });
    if (!segments.length) segments.push({ text, bold: false });
    return segments;
  }
}
