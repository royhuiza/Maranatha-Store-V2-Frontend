import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
@Component({standalone:true,imports:[CommonModule,FormsModule],template: `
<div class="page-title"><h2>Usuarios y roles</h2></div><p class="notice" role="status">{{mensaje}}</p>
<div class="team-workspace">
<section class="panel team-create"><span class="module-kicker">ACCESO DEL EQUIPO</span><h3>Crear cuenta</h3><form #f="ngForm" (ngSubmit)="crear()">
<label>Usuario<input name="username" [(ngModel)]="nuevo.username" required minlength="3" maxlength="50" autocomplete="off"></label>
<label>Correo<input name="email" type="email" [(ngModel)]="nuevo.email" required email maxlength="120"></label>
<label>Contraseña inicial<input name="password" type="password" [(ngModel)]="nuevo.password" required minlength="10" maxlength="72" autocomplete="new-password"></label>
<label>Rol<select name="rol" [(ngModel)]="nuevo.rol"><option value="USER">Vendedor</option><option value="ADMIN">Administrador</option></select></label>
<p>Vendedor: consulta inventario, administra clientes y registra ventas. Administrador: además mantiene inventario, anula ventas, consulta reportes y crea cuentas.</p>
<button [disabled]="f.invalid || guardando">{{guardando ? 'Guardando...' : 'Crear usuario'}}</button></form></section>
<section class="panel team-directory"><span class="module-kicker">DIRECTORIO</span><h3>Cuentas registradas <span class="team-count">{{lista.length}}</span></h3><div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th></tr></thead><tbody><tr *ngFor="let u of lista"><td>{{u.username}}</td><td>{{u.email}}</td><td><span class="team-role" [class.team-role-admin]="u.rol === 'ADMIN'">{{u.rol}}</span></td></tr></tbody></table></div></section>
</div>`})
export class UsuariosComponent implements OnInit {
 private api=inject(ApiService); lista: Array<{id:number;username:string;email:string;rol:string}>=[]; mensaje=''; guardando=false;
 nuevo={username:'',email:'',password:'',rol:'USER'};
 ngOnInit(){this.cargar();}
 cargar(){this.api.usuarios().subscribe({next: u=>this.lista=u,error:e=>this.mensaje=e.error?.message || 'No se pudieron consultar los usuarios.'});}
 crear(){if(this.guardando)return;this.guardando=true;this.api.crearUsuario(this.nuevo).subscribe({next:()=>{this.guardando=false;this.mensaje='Cuenta creada. Ya puede iniciar sesión.';this.nuevo={username:'',email:'',password:'',rol:'USER'};this.cargar();},error:e=>{this.guardando=false;this.mensaje=e.error?.message || 'No se pudo crear la cuenta.';}});}
}
