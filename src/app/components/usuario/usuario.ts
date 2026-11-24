import { Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
interface Cuenta {id:number;username:string;email:string;rol:string;activo:boolean}
@Component({standalone:true,imports:[CommonModule,FormsModule],styleUrls: ['./usuario.css'], templateUrl: './usuario.html'})
export class UsuariosComponent implements OnInit {
 private api=inject(ApiService); lista: Cuenta[]=[]; mensaje=''; guardando=false;
 mostrarPassword=false;
 camposEditados = { usuario: false, correo: false, clave: false };
 get correoFormatoValido(){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.nuevo.email) && this.nuevo.email.length <= 120;}
 get claveFormatoValido(){return (this.editId!==null && !this.nuevo.password.length) || (this.nuevo.password.length >= 10 && new TextEncoder().encode(this.nuevo.password).length <= 72);}

 editId:number|null=null; detalle: {id:number;username:string;email:string;rol:string;activo:boolean}|null=null;
 get propia(){return (localStorage.getItem('username')||'').toLowerCase();}
 protegido(u:{username:string;rol:string;activo:boolean}){return u.username.toLowerCase()===this.propia || (u.activo && u.rol==='ADMIN' && this.lista.filter(x=>x.activo&&x.rol==='ADMIN').length<=1);}
 editar(u:Cuenta){this.mostrarPassword=false;this.camposEditados={usuario:false,correo:false,clave:false};this.editId=u.id;this.detalle=null;this.nuevo={username:u.username,email:u.email,rol:u.rol,password:''};this.mensaje='';}
 cancelar(){this.editId=null;this.nuevo={username:'',email:'',password:'',rol:'VENDEDOR'};this.mostrarPassword=false;this.camposEditados={usuario:false,correo:false,clave:false};}
 cambiarEstado(u:Cuenta){if(this.guardando || (u.activo&&this.protegido(u)))return;if(!confirm(`${u.activo?'Desactivar':'Reactivar'} la cuenta ${u.username}?`))return;this.guardando=true;const peticion: Observable<unknown> = u.activo ? this.api.eliminarUsuario(u.id) : this.api.reactivarUsuario(u.id);peticion.subscribe({next:()=>{this.guardando=false;this.mensaje='Estado actualizado.';this.cancelar();this.cargar();},error:(e: HttpErrorResponse)=>{this.guardando=false;this.mensaje=e.error?.message||'No se pudo actualizar la cuenta.';}});}

 nuevo={username:'',email:'',password:'',rol:'VENDEDOR'};
 ngOnInit(){this.cargar();}
 cargar(){this.api.usuarios().subscribe({next: u=>this.lista=u,error:(e: HttpErrorResponse)=>this.mensaje=e.error?.message || 'No se pudieron consultar los usuarios.'});}
 get usuarioDuplicado(): boolean {
  const valor = this.nuevo.username.trim().toLowerCase();
  return !!valor && this.lista.some(u => u.id !== this.editId && u.username.trim().toLowerCase() === valor);
 }
 get correoDuplicado(): boolean {
  const valor = this.nuevo.email.trim().toLowerCase();
  return !!valor && this.lista.some(u => u.id !== this.editId && u.email.trim().toLowerCase() === valor);
 }
 get faltantes(): string[] {
  const errores: string[] = [];
  if (this.nuevo.username.trim().length < 3 || this.nuevo.username.length > 50) errores.push('Usuario: entre 3 y 50 caracteres.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.nuevo.email) || this.nuevo.email.length > 120) errores.push('Correo: ingresa una dirección válida.');
  if ((this.editId===null || this.nuevo.password.length>0) && (this.nuevo.password.length < 10 || new TextEncoder().encode(this.nuevo.password).length > 72)) errores.push('Contraseña: entre 10 y 72 caracteres.');
  if (!['ADMIN', 'VENDEDOR'].includes(this.nuevo.rol)) errores.push('Selecciona un rol válido.');
  if (this.usuarioDuplicado) errores.push('El nombre de usuario ya está registrado.');
  if (this.correoDuplicado) errores.push('El correo ya está registrado por otro usuario.');
  return errores;
 }
 crear(){if(this.guardando || this.faltantes.length)return;this.mensaje='';this.guardando=true;const datos={username:this.nuevo.username.trim(),email:this.nuevo.email.trim(),rol:this.nuevo.rol};const peticion: Observable<unknown> = this.editId===null?this.api.crearUsuario({...datos,password:this.nuevo.password}):this.api.actualizarUsuario(this.editId,{...datos,...(this.nuevo.password?{password:this.nuevo.password}:{})});peticion.subscribe({next:()=>{this.guardando=false;this.mensaje=this.editId===null?'Cuenta creada. Ya puede iniciar sesión.':'Cuenta actualizada.';this.editId=null;this.mostrarPassword=false;this.camposEditados={usuario:false,correo:false,clave:false};this.nuevo={username:'',email:'',password:'',rol:'VENDEDOR'};this.cargar();},error:(e: HttpErrorResponse)=>{this.guardando=false;this.mensaje=e.status===403 ? 'Acceso denegado. Inicia sesión con una cuenta administradora y verifica los permisos.' : (e.error?.message || (e.status===409 ? 'El usuario o correo ya está registrado.' : 'No se pudo guardar la cuenta.'));if(e.status===409)this.cargar();}});}
}
