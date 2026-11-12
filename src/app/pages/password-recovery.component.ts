import { ThemePreference } from '../core/theme-preference';
import { OriginkitSceneComponent } from '../core/originkit-scene.component';
import { LoginCountdown } from '../core/login-countdown';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { localMailboxAvailable } from '../core/local-mailbox';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink,OriginkitSceneComponent],template:`
<main class="login-page login-experience authkit-login authkit-recovery" [class.login-dark]="theme.dark()">
  <section class="login-stage" aria-label="Recuperación de acceso">
    <app-originkit-scene effect="reactive" />
    <div class="login-stage-pattern" aria-hidden="true"></div>
    <div class="stage-top"><img class="maranatha-brand-image stage-brand-image" src="/maranatha-logo.png" alt="Librería Maranatha"></div>
    <div class="stage-copy">
      <span class="stage-kicker"><span class="live-dot"></span> ACCESO SEGURO</span>
      <h1>Tu librería,<br><em>a un paso.</em></h1>
      <p>Recupera el acceso a tu espacio de trabajo.</p>
    </div>
    <div class="authkit-caption" aria-hidden="true"><span>02 / MARANATHA STORE</span><span>RECUPERACIÓN DE ACCESO</span></div>
  </section>
  <section class="login-panel">
    <div class="login-panel-top recovery-top">
      <a class="login-theme-toggle" routerLink="/login">← Volver al inicio de sesión</a>
      <button type="button" class="login-theme-toggle theme-switch" (click)="theme.toggle($event, view)" [attr.aria-pressed]="theme.dark()"
        [attr.aria-label]="theme.dark() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'">{{theme.dark() ? '☀ Claro' : '☾ Oscuro'}}</button>
    </div>
    <section class="login-card auth-reveal">
      <div class="login-eyebrow recovery-status">TU CUENTA</div>
      <h2>Recuperación de contraseña</h2>
      <ol class="auth-steps">
        <li [attr.aria-current]="!token ? 'step' : null">Solicita el enlace</li>
        <li [attr.aria-current]="token ? 'step' : null">Crea tu contraseña</li>
      </ol>
<form class="auth-step-reveal" *ngIf="!token" #f="ngForm" (ngSubmit)="solicitar()"><p>Escribe el correo que el administrador registró al crear tu usuario. Te enviaremos un enlace de un solo uso para crear una nueva contraseña.</p><label>Correo electrónico<input type="email" name="email" [(ngModel)]="email" required email maxlength="120" autocomplete="email"></label><button class="login-submit" type="submit" [disabled]="f.invalid || ocupado">Enviar enlace</button></form>
<form class="auth-step-reveal" *ngIf="token && !terminado" #r="ngForm" (ngSubmit)="restablecer()"><p>El enlace vence en 15 minutos y solo puede utilizarse una vez.</p><label>Nueva contraseña<input type="password" name="password" [(ngModel)]="password" required minlength="10" maxlength="72" autocomplete="new-password"></label><label>Confirmar contraseña<input type="password" name="confirm" [(ngModel)]="confirm" required autocomplete="new-password"></label><button class="login-submit" type="submit" [disabled]="r.invalid || ocupado">Guardar nueva contraseña</button></form>
<div class="recovery-mailbox-link" *ngIf="mensaje && !token && buzonLocal"><p>¿Estás probando la recuperación en este equipo?</p><a routerLink="/buzon-pruebas" [state]="{ destinatario: correoSolicitado }">Abrir buzón de pruebas de Maranatha →</a></div><p class="recovery-countdown" *ngIf="terminado" role="status">Volviendo al login en <strong>{{cuenta}}</strong> segundos…</p><p class="recovery-success" role="status">{{mensaje}}</p><p class="error" role="alert">{{error}}</p></section>
  </section>
</main>`})
export class PasswordRecoveryComponent implements OnDestroy {
 readonly theme = inject(ThemePreference);
  readonly view = inject(ChangeDetectorRef);

 private readonly router=inject(Router); readonly buzonLocal=localMailboxAvailable(); cuenta=3;private request?:Subscription;private countdown=new LoginCountdown(n=>this.cuenta=n,()=>{void this.router.navigateByUrl('/login');});
 ngOnDestroy(){this.countdown.cancel();this.request?.unsubscribe();}
 private volverAlLogin(){this.countdown.start();}

 private http=inject(HttpClient);token=inject(ActivatedRoute).snapshot.queryParamMap.get('token')||'';
 email='';correoSolicitado='';password='';confirm='';ocupado=false;terminado=false;mensaje='';error='';
 solicitar(){const email=this.email.trim();this.ocupado=true;this.error='';this.mensaje='';this.request=this.http.post(`${environment.apiUrl}/auth/password/forgot`,{email}).subscribe({next:()=>{this.ocupado=false;this.correoSolicitado=email;this.mensaje='Si la cuenta existe, recibirás un enlace de recuperación.';},error:e=>{this.ocupado=false;this.error=e.error?.message||'No se pudo solicitar la recuperación.';}});}
 restablecer(){if(this.password!==this.confirm){this.error='Las contraseñas no coinciden.';return;}this.ocupado=true;this.error='';this.request=this.http.post(`${environment.apiUrl}/auth/password/reset`,{token:this.token,password:this.password}).subscribe({next:()=>{this.ocupado=false;this.terminado=true;this.password='';this.confirm='';this.mensaje='Contraseña guardada. Ya puedes iniciar sesión con la nueva contraseña.';this.volverAlLogin();},error:e=>{this.ocupado=false;this.error=e.error?.message||'No se pudo restablecer la contraseña.';}});}
}
