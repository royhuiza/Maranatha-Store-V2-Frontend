import { fechaLocal, rangoRapido, rangoValido } from '../../services/periodo';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { forkJoin, timer, exhaustMap, catchError, EMPTY } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api';
import { Venta, Producto } from '../../models';
@Component({standalone:true,imports:[CommonModule,FormsModule],styleUrls: ['./reporte.css'], templateUrl: './reporte.html'})
export class ReportesComponent implements OnInit {
 private api=inject(ApiService); ventas:Venta[]=[]; productos:Producto[]=[]; pestana:'ventas'|'productos'='ventas'; inventarioListo=false; error=''; periodo='mes'; hoy=fechaLocal(); desde=rangoRapido('mes')[0]; hasta=this.hoy;
 cambiarPeriodo(){if(this.periodo!=='personalizado')[this.desde,this.hasta]=rangoRapido(this.periodo);}
 get valido(){return rangoValido(this.desde,this.hasta);}
 private local(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
 private destroyRef=inject(DestroyRef);
 ngOnInit(){timer(0,30000).pipe(exhaustMap(()=>forkJoin([this.api.ventas(),this.api.productos()]).pipe(catchError(()=>{this.error='No se pudieron actualizar los reportes.';return EMPTY;}))),takeUntilDestroyed(this.destroyRef)).subscribe(([v,p])=>{this.ventas=v;this.productos=p;this.inventarioListo=true;this.error='';});}
 get finVisible(){const d=new Date(this.limites[1]);d.setDate(d.getDate()-1);return d;}
 cargar(){this.api.ventas().subscribe({next:v=>{this.ventas=v;this.error='';},error:()=>this.error='No se pudieron actualizar los reportes.'});}
 get limites():[Date,Date]{const a=new Date(this.desde+'T00:00:00'),b=new Date(this.hasta+'T00:00:00');b.setDate(b.getDate()+1);return [a,b];}
 get filtradas(){const [a,b]=this.limites;return !this.valido?[]:this.ventas.filter(v=>v.estado==='EMITIDA'&&new Date(v.fecha)>=a&&new Date(v.fecha)<b);}
 get total(){return this.filtradas.reduce((n,v)=>n+Number(v.total),0);} get promedio(){return this.filtradas.length?this.total/this.filtradas.length:0;}
 get grupos(){const mapa=new Map<string,number>();for(const v of this.filtradas){const nombre=v.fecha.slice(0,this.periodo==='anual'?7:10);mapa.set(nombre,(mapa.get(nombre)||0)+Number(v.total));}return [...mapa].sort(([a],[b])=>a.localeCompare(b)).map(([nombre,total])=>({nombre,total}));}
 get ranking(){const m=new Map<number,{nombre:string,cantidad:number,total:number}>();for(const v of this.filtradas)for(const d of v.detalles||[]){const x=m.get(d.productoId)||{nombre:d.productoNombre || `Producto ${d.productoId}`,cantidad:0,total:0};x.cantidad+=Number(d.cantidad);x.total+=Number(d.subtotal ?? 0);m.set(d.productoId,x);}return [...m.values()].sort((a,b)=>b.cantidad-a.cantidad).slice(0,10);}
 get maximo(){return Math.max(1,...this.grupos.map(g=>g.total));}
 exportarVentas(){if(!this.valido)return;this.guardar('ventas-'+this.desde+'-'+this.hasta+'.xlsx',this.filtradas.map(v=>({Comprobante:v.serie+'-'+v.numero,Fecha:v.fecha,Total:v.total,Estado:v.estado})));}
 get activos(){return this.productos.filter(p=>p.activo!==false);}
 get bajos(){return this.activos.filter(p=>p.stock>0&&p.stock<=10).length;}
 get agotados(){return this.activos.filter(p=>p.stock<=0).length;}
 get unidades(){return this.activos.reduce((n,p)=>n+Number(p.stock),0);}
 estado(p:Producto){return p.activo===false?'Inactivo':p.stock<=0?'Sin stock':p.stock<=10?'Stock bajo':'Disponible';}
 private filasProductos(p:Producto[]){return p.map(x=>({Código:x.codigo??'',Producto:x.nombre,Precio:x.precio,Stock:x.stock,Estado:this.estado(x)}));}
 inventario(){if(!this.inventarioListo)return;this.guardar('inventario-'+fechaLocal()+'.xlsx',this.filasProductos(this.productos));}
 integral(){if(!this.valido)return;forkJoin([this.api.productos(),this.api.ventas()]).subscribe({next:([productos,ventas])=>{this.ventas=ventas;const seleccion=this.filtradas;this.guardarLibro('reporte-integral-'+this.desde+'-'+this.hasta+'.xlsx',{Productos:this.filasProductos(productos),Ventas:seleccion.map(v=>({Comprobante:v.serie+'-'+v.numero,Fecha:v.fecha,Total:v.total,Estado:v.estado})),Detalles:seleccion.flatMap(v=>(v.detalles||[]).map(d=>({VentaID:v.id,Comprobante:v.serie+'-'+v.numero,...d})))});},error:()=>this.error='No se pudo descargar el informe integral.'});}
 private guardarLibro(nombre:string,hojas:Record<string,unknown[]>){const libro=XLSX.utils.book_new();for(const [hoja,datos]of Object.entries(hojas)){XLSX.utils.book_append_sheet(libro,XLSX.utils.json_to_sheet(datos as Record<string, unknown>[]),hoja);}XLSX.writeFile(libro,nombre);}
 private guardar(nombre:string,datos:unknown[]){const libro=XLSX.utils.book_new();XLSX.utils.book_append_sheet(libro,XLSX.utils.json_to_sheet(datos as Record<string, unknown>[]),'Reporte');XLSX.writeFile(libro,nombre);}
}
