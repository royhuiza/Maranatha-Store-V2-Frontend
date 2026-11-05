import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
interface Message {ID:string; Subject:string; Created:string; To:Array<{Address:string}>}
@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink],template:`
<main class="recovery-page"><div class="mailbox-shell"><header class="recovery-header"><img src="/maranatha-logo.png" alt="Librería Maranatha"><a routerLink="/recuperar-contrasena">← Volver a recuperación</a></header>
<section class="mailbox-intro"><span class="recovery-eyebrow">ENTORNO LOCAL DE PRUEBAS</span><h1>Buzón de Maranatha</h1><p>Aquí puedes leer los enlaces de recuperación de este equipo. Este buzón de desarrollo no está disponible en producción.</p></section>
<div class="mailbox-toolbar"><label>Filtrar destinatario<input [(ngModel)]="correo" placeholder="Correo registrado"></label><button (click)="cargar()" [disabled]="cargando">Actualizar</button></div><p class="error" role="alert">{{error}}</p>
<section class="mailbox-grid"><div class="mailbox-list"><button *ngFor="let m of visibles" (click)="abrir(m)" [class.active]="seleccionado===m.ID"><b>{{m.Subject}}</b><span>{{destinatarios(m)}}</span><small>{{m.Created | date:'dd/MM/yyyy HH:mm:ss':'-0500'}}</small></button><p *ngIf="!visibles.length">No hay mensajes para mostrar. Solicita un enlace con el correo de una cuenta registrada.</p></div>
<article class="mailbox-message"><h2>{{asunto || 'Selecciona un mensaje'}}</h2><pre>{{texto}}</pre><a *ngIf="token" class="save-pdf-link" routerLink="/recuperar-contrasena" [queryParams]="{token:token}">Crear nueva contraseña</a><p *ngIf="token">El enlace del mensaje vence en 15 minutos y solo se usa una vez.</p></article></section>
</div></main>`})
export class LocalMailboxComponent implements OnInit, OnDestroy {
 private readonly http=inject(HttpClient); private timer?:ReturnType<typeof setInterval>;private requests=new Subscription();private messageRequest?:Subscription;
 mensajes:Message[]=[];correo='';cargando=false;error='';seleccionado='';texto='';asunto='';token='';
 ngOnInit(){this.cargar();this.timer=setInterval(()=>this.cargar(),5000);}
 ngOnDestroy(){clearInterval(this.timer);this.requests.unsubscribe();this.messageRequest?.unsubscribe();}
 destinatarios(m:Message){return (m.To||[]).map(t=>t.Address).join(', ');}
 get visibles(){return this.mensajes.filter(m=>this.destinatarios(m).toLowerCase().includes(this.correo.trim().toLowerCase()));}
 cargar(){if(this.cargando)return;this.cargando=true;this.requests.add(this.http.get<{messages:Message[]}>('/correo-pruebas-api/messages').subscribe({next:r=>{this.mensajes=r.messages||[];this.error='';this.cargando=false;},error:()=>{this.cargando=false;this.error='No se pudo abrir el buzón local. Comprueba Mailpit y reinicia el frontend con npm start.';}}));}
 abrir(m:Message){this.messageRequest?.unsubscribe();this.seleccionado=m.ID;this.token='';this.texto='Cargando mensaje…';this.asunto=m.Subject;this.messageRequest=this.http.get<{Text:string}>('/correo-pruebas-api/message/'+encodeURIComponent(m.ID)).subscribe({next:r=>{this.texto=r.Text||'';const match=this.texto.match(/https?:\/\/(?:localhost|127\.0\.0\.1):4200\/recuperar-contrasena\?token=([A-Za-z0-9_-]{40,100})(?![A-Za-z0-9_-])/);this.token=match?.[1]||'';},error:()=>this.texto='No se pudo cargar el mensaje.'});}
}
