import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EMPTY, catchError, finalize } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Mensaje {
  role: 'user' | 'assistant' | 'typing' | 'error';
  content: string;
}

export interface ChatResponse {
  reply: string;
}

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-widget.component.html',
  styleUrls: ['./chat-widget.component.css'],
})
export class ChatWidgetComponent {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/v1/chat`;

  open = false;
  isLoading = false;
  messages: Mensaje[] = [
    { role: 'assistant', content: 'Hola, soy el **Asistente Maranata AI**. ¿En qué puedo ayudarte?' },
  ];
  input = '';

  @ViewChild('msgList') msgList?: ElementRef<HTMLElement>;

  toggle(): void {
    this.open = !this.open;
    if (this.open) {
      this.scrollBottom();
    }
  }

  send(): void {
    const text = this.input.trim();
    if (!text || this.isLoading) return;

    this.messages.push({ role: 'user', content: text });
    this.input = '';
    const typingIndex = this.messages.push({ role: 'typing', content: '' }) - 1;
    this.isLoading = true;
    this.scrollBottom();

    this.http.post<ChatResponse>(this.endpoint, { message: text })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.messages[typingIndex] = {
            role: 'error',
            content: error.status === 0
              ? '⚠️ No se pudo conectar con el asistente. Verifica que el backend esté activo y reinicia el frontend.'
              : `⚠️ El servidor respondió con error (${error.status}). Revisa la respuesta del backend e intenta de nuevo.`,
          };
          this.scrollBottom();
          return EMPTY;
        }),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: response => {
          if (typeof response?.reply !== 'string') {
            this.messages[typingIndex] = {
              role: 'error',
              content: '⚠️ El asistente devolvió una respuesta no válida. Intenta de nuevo.',
            };
          } else {
            this.messages[typingIndex] = { role: 'assistant', content: response.reply };
          }
          this.scrollBottom();
        },
      });
  }

  onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  private scrollBottom(): void {
    setTimeout(() => {
      const el = this.msgList?.nativeElement;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }, 30);
  }

  format(content: string): string {
    return (content ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }
}
