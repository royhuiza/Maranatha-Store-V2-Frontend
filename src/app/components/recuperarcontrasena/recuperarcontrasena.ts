import { ThemePreference } from '../../core/theme-preference';
import { OriginkitSceneComponent } from '../../core/originkit-scene.component';
import { LoginCountdown } from '../../core/login-countdown';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { localMailboxAvailable } from '../../core/local-mailbox';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink,OriginkitSceneComponent],styleUrls: ['./recuperarcontrasena.css'], templateUrl: './recuperarcontrasena.html'})
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
