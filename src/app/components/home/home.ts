import { rangoRapido } from '../../services/periodo';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { ApiService } from '../../services/api';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly api=inject(ApiService);
  private intervalo?: ReturnType<typeof setInterval>;
  private consulta?: Subscription;
  periodo='7'; desde=rangoRapido('7')[0]; hasta=rangoRapido('7')[1]; cambiarPeriodo(p:string){if(!['7','15','30'].includes(p)||p===this.periodo)return;this.periodo=p;this.cargar();} productos=0; stockBajo=0; sinStock=0; totalHoy=0; totalMes=0; ventas=0; unidadesSemana=0;
  cargando=false; cargado=false; error=''; actualizado?:Date;
  topProductos: Array<{nombre:string; cantidad:number}> = [];
  dias:Array<{fecha:string;total:number}>=[];
  nombreDia(fecha:string):string{return new Date(fecha+'T12:00:00').toLocaleDateString('es-PE',{weekday:'short'});}
  get puntos(){return this.dias.map((d,i)=>({ ...d,x:80+i*650/Math.max(1,this.dias.length-1),y:210-d.total/this.maximo*180 }));}
  get linea(){return this.puntos.map(p=>`${p.x},${p.y}`).join(' ');}
  get area(){return this.puntos.length?`80,210 ${this.linea} 730,210`:'';}
  get marcas(){return [0,.25,.5,.75,1].map(f=>({y:210-f*180,total:this.maximo*f}));}
  get maxRanking(){return Math.max(1,...this.topProductos.map(p=>p.cantidad));}
  mostrarFecha(i:number){return i===0||i===this.dias.length-1||i%Math.ceil(this.dias.length/6)===0;}
  get hoy():string{return this.fechaLocal(new Date());}
  get maximo():number{return Math.max(1,...this.dias.map(d=>d.total));}
  get totalSemana():number{return this.dias.reduce((n,d)=>n+d.total,0);}
  get porcentajeDisponible():number{return this.productos?(this.productos-this.stockBajo)/this.productos*100:0;}
  get anillo():string{return 'conic-gradient(#40867a 0% '+this.porcentajeDisponible+'%,#d6a264 '+this.porcentajeDisponible+'% 100%)';}
  ngOnInit():void{this.cargar();this.intervalo=setInterval(()=>this.cargar(),30000);}
  ngOnDestroy():void{clearInterval(this.intervalo);this.consulta?.unsubscribe();}
  private fechaLocal(d:Date):string{return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
  cargar():void {
    this.consulta?.unsubscribe();this.cargando=true;[this.desde,this.hasta]=rangoRapido(this.periodo);
    this.consulta=forkJoin([this.api.productos(),this.api.ventas(),this.api.productosStockBajo()]).subscribe({
      next:([productos,ventas,bajos])=>{
        const emitidas=ventas.filter(v=>v.estado==='EMITIDA');
        this.productos=productos.filter(p=>p.activo!==false).length;
        this.stockBajo=bajos.length; // T39: lo calcula el backend con el stock mínimo de cada artículo
        this.sinStock=productos.filter(p=>p.activo!==false && p.stock===0).length; this.totalHoy=emitidas.filter(v=>v.fecha.slice(0,10)===this.hoy).reduce((n,v)=>n+Number(v.total),0); this.totalMes=emitidas.filter(v=>v.fecha.slice(0,7)===this.hoy.slice(0,7)).reduce((n,v)=>n+Number(v.total),0);this.ventas=emitidas.length;
        this.dias=Array.from({length:Number(this.periodo)},(_,i)=>{const d=new Date(this.desde+'T12:00:00');d.setDate(d.getDate()+i);const fecha=this.fechaLocal(d);return {fecha,total:emitidas.filter(v=>v.fecha.slice(0,10)===fecha).reduce((n,v)=>n+Number(v.total),0)};});
        const fechas=new Set(this.dias.map(d=>d.fecha));this.unidadesSemana=emitidas.filter(v=>fechas.has(v.fecha.slice(0,10))).flatMap(v=>v.detalles||[]).reduce((n,d)=>n+Number(d.cantidad),0);
        const ranking = new Map<number,{nombre:string;cantidad:number}>();
        for (const d of emitidas.filter(v=>fechas.has(v.fecha.slice(0,10))).flatMap(v=>v.detalles||[])) {
          const item = ranking.get(d.productoId) || {nombre:d.productoNombre || productos.find(p=>p.id===d.productoId)?.nombre || 'Producto',cantidad:0};
          item.cantidad += Number(d.cantidad); ranking.set(d.productoId,item);
        }
        this.topProductos = [...ranking.values()].sort((a,b)=>b.cantidad-a.cantidad).slice(0,5);
        this.cargando=false;this.cargado=true;this.error='';this.actualizado=new Date();
      },error:()=>{this.cargando=false;this.error=this.cargado?'No se pudieron actualizar los datos. Se conserva la última consulta.':'No se pudieron consultar los indicadores. Verifique los servicios del backend.';}
    });
  }
}
