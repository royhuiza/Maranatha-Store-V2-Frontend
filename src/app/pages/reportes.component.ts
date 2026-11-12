import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { forkJoin } from 'rxjs';
import { ApiService } from '../core/api.service';
import { Venta } from '../models';
@Component({standalone:true,imports:[CommonModule,FormsModule],template:`
<div class="page-title"><h2>Reportes estadísticos</h2><button class="secondary" (click)="cargar()">Actualizar datos</button></div>
<p class="error" role="alert">{{error}}</p><section class="panel report-workspace"><div class="report-section-title"><span class="module-kicker">ACTIVIDAD COMERCIAL</span><h3>Ventas del período</h3></div><div class="row report-filters">
<label>Período<select [(ngModel)]="periodo"><option value="semana">Semanal</option><option value="mes">Mensual</option><option value="anual">Anual</option></select></label>
<label>Fecha de referencia<input type="date" [(ngModel)]="fecha"></label></div><p>Se excluyen ventas anuladas.</p>
<div class="cards report-metrics"><article><span>Ventas</span><strong>{{filtradas.length}}</strong></article><article class="report-feature"><span>Total registrado</span><strong>S/ {{total | number:'1.2-2'}}</strong></article><article><span>Promedio por venta</span><strong>S/ {{promedio | number:'1.2-2'}}</strong></article></div>
<div class="report-chart" *ngIf="filtradas.length">
  <div class="report-chart-row" *ngFor="let grupo of grupos">
    <span>{{grupo.nombre}}</span>
    <div class="report-track" aria-hidden="true"><div class="stat-bar" [style.width.%]="grupo.total / maximo * 100"></div></div>
    <strong>S/ {{grupo.total | number:'1.2-2'}}</strong>
  </div>
</div><p *ngIf="!filtradas.length">No hay ventas emitidas para este período.</p>
<div class="report-actions"><button class="workspace-primary" (click)="exportarVentas()">Exportar ventas del período</button><button class="secondary" (click)="integral()">Exportar informe integral</button></div></section>
<section class="panel report-inventory"><div><span class="module-kicker">CATÁLOGO</span><h3>Inventario actual</h3></div><button (click)="inventario()">Descargar Excel actualizado</button></section>`})
export class ReportesComponent implements OnInit {
 private api=inject(ApiService); ventas:Venta[]=[]; error=''; periodo='mes'; fecha=new Date().toLocaleDateString('en-CA');
 ngOnInit(){this.cargar();}
 cargar(){this.api.ventas().subscribe({next:v=>{this.ventas=v;this.error='';},error:()=>this.error='No se pudieron actualizar los reportes.'});}
 get limites():[Date,Date]{const d=new Date(this.fecha+'T00:00:00');let inicio:Date,fin:Date;if(this.periodo==='anual'){inicio=new Date(d.getFullYear(),0,1);fin=new Date(d.getFullYear()+1,0,1);}else if(this.periodo==='mes'){inicio=new Date(d.getFullYear(),d.getMonth(),1);fin=new Date(d.getFullYear(),d.getMonth()+1,1);}else{inicio=new Date(d);inicio.setDate(d.getDate()-((d.getDay()+6)%7));fin=new Date(inicio);fin.setDate(fin.getDate()+7);}return [inicio,fin];}
 get filtradas(){const [a,b]=this.limites;return this.ventas.filter(v=>v.estado==='EMITIDA'&&new Date(v.fecha)>=a&&new Date(v.fecha)<b);}
 get total(){return this.filtradas.reduce((n,v)=>n+Number(v.total),0);} get promedio(){return this.filtradas.length?this.total/this.filtradas.length:0;}
 get grupos(){const mapa=new Map<string,number>();for(const v of this.filtradas){const nombre=v.fecha.slice(0,this.periodo==='anual'?7:10);mapa.set(nombre,(mapa.get(nombre)||0)+Number(v.total));}return [...mapa].sort(([a],[b])=>a.localeCompare(b)).map(([nombre,total])=>({nombre,total}));}
 get maximo(){return Math.max(1,...this.grupos.map(g=>g.total));}
 exportarVentas(){this.guardar('ventas-'+this.periodo+'.xlsx',this.filtradas.map(v=>({Comprobante:v.serie+'-'+v.numero,Fecha:v.fecha,Cliente:v.clienteNombre,Total:v.total,Estado:v.estado})));}
 inventario(){this.api.productos().subscribe({next:p=>this.guardar('inventario-actual.xlsx',p),error:()=>this.error='No se pudo descargar el inventario.'});}
 integral(){forkJoin([this.api.productos(),this.api.clientes(),this.api.ventas()]).subscribe({next:([productos,clientes,ventas])=>{this.ventas=ventas;const seleccion=this.filtradas;this.guardarLibro('reporte-integral.xlsx',{Productos:productos,Clientes:clientes,Ventas:seleccion,Detalles:seleccion.flatMap(v=>v.detalles.map(d=>({VentaID:v.id,Comprobante:v.serie+'-'+v.numero,...d})))});},error:()=>this.error='No se pudo descargar el informe integral.'});}
 private guardarLibro(nombre:string,hojas:Record<string,unknown[]>){const libro=XLSX.utils.book_new();for(const [hoja,datos]of Object.entries(hojas)){XLSX.utils.book_append_sheet(libro,XLSX.utils.json_to_sheet(datos),hoja);}XLSX.writeFile(libro,nombre);}
 private guardar(nombre:string,datos:unknown[]){const libro=XLSX.utils.book_new();XLSX.utils.book_append_sheet(libro,XLSX.utils.json_to_sheet(datos),'Reporte');XLSX.writeFile(libro,nombre);}
}
