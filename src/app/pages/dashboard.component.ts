import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="business-overview">
      <div class="overview-heading"><div><span class="eyebrow">RESUMEN OPERATIVO</span><h2>Tu negocio en cifras.</h2><p>Consulta la actividad comercial y la disponibilidad del catálogo.</p></div><button class="secondary" (click)="cargar()" [disabled]="cargando">{{ cargando ? 'Actualizando…' : '↻ Actualizar' }}</button></div>
      <div *ngIf="error" class="notice error-notice" role="alert">{{error}}</div>
      <div *ngIf="!cargado && cargando" class="loading-overview" role="status">Consultando los datos del negocio…</div>
      <ng-container *ngIf="cargado">
        <div class="overview-metrics">
          <article class="overview-metric metric-feature"><span class="metric-icon" aria-hidden="true">↗</span><span>Ventas emitidas</span><strong>{{ventas}}</strong><small>Historial sin anuladas</small></article>
          <article class="overview-metric"><span class="metric-icon" aria-hidden="true">▤</span><span>Productos activos</span><strong>{{productos}}</strong><small>Artículos en el catálogo</small></article>
          <article class="overview-metric metric-warning"><span class="metric-icon" aria-hidden="true">!</span><span>Por reponer</span><strong>{{stockBajo}}</strong><small>Con 5 unidades o menos</small></article>
          <article class="overview-metric"><span class="metric-icon" aria-hidden="true">♙</span><span>Clientes</span><strong>{{clientes}}</strong><small>Registros activos</small></article>
        </div>
        <div class="overview-charts">
          <article class="overview-glass sales-activity"><div class="chart-heading"><div><span class="eyebrow">ACTIVIDAD COMERCIAL</span><h3>Ventas de la semana</h3></div><span class="period-pill">Últimos 7 días</span></div>
            <div class="sales-amount"><strong>S/ {{totalSemana | number:'1.2-2'}}</strong><span>Total registrado<br><small>{{unidadesSemana}} unidades vendidas</small></span></div>
            <div class="weekly-chart" aria-label="Ventas registradas por día"><div class="day-column" *ngFor="let d of dias"><div class="day-track"><span class="day-amount">{{d.total | number:'1.2-2'}}</span><div class="day-bar" [style.height.%]="d.total / maximo * 78" [class.day-bar-today]="d.fecha===hoy" [attr.title]="d.fecha + ': S/ ' + d.total"></div></div><span class="day-label">{{nombreDia(d.fecha)}}</span><small>{{d.fecha | date:'dd/MM'}}</small></div></div>
            <p class="chart-footnote">Ventas emitidas, sin anulaciones. Los importes no acreditan un cobro confirmado.</p>
          </article>
          <article class="overview-glass inventory-health"><span class="eyebrow">SALUD DEL INVENTARIO</span><h3>Listos para vender</h3><div class="stock-ring" [style.background]="anillo" role="img" [attr.aria-label]="(productos-stockBajo) + ' productos disponibles de ' + productos"><div><strong>{{porcentajeDisponible | number:'1.0-0'}}<span>%</span></strong><small>del catálogo activo</small></div></div><div class="stock-legend"><span><i class="legend-available"></i>Stock disponible<b>{{productos-stockBajo}}</b></span><span><i class="legend-low"></i>Requieren reposición<b>{{stockBajo}}</b></span></div><a routerLink="/productos" class="overview-action">Revisar inventario <span>↗</span></a></article>
        </div>
        <div class="overview-bottom"><span><i></i>Actualizado {{actualizado | date:'HH:mm:ss'}} · Cada 30 segundos</span><a routerLink="/ventas">Ir a ventas →</a></div>
      </ng-container>
    </section>
  `,
  styles: [`
    :host{display:block}.business-overview{--ink:#203c37;--muted:#556963;--card:rgba(255,255,255,.76);--border:rgba(255,255,255,.8);--ring-center:#f4f3ed;color:var(--ink);padding:28px;border:1px solid #ffffff8c;border-radius:26px;background:radial-gradient(ellipse at 5% 0%,#c8d9ca91,transparent 50%),radial-gradient(ellipse at 100% 80%,#dbcce982,transparent 50%),linear-gradient(135deg,#f2eee4,#e8eee8);box-shadow:0 24px 65px #163b3220}
    .overview-heading,.chart-heading{display:flex;justify-content:space-between;align-items:center;gap:18px}.overview-heading{margin-bottom:26px}.eyebrow{font-size:10px;font-weight:800;letter-spacing:1.8px;color:var(--muted)}h2{font-size:clamp(24px,2.4vw,34px);letter-spacing:-1px;margin:8px 0 6px;color:var(--ink)}h3{font-size:18px;margin:9px 0;color:var(--ink)}p{color:var(--muted);margin:0;line-height:1.6}.overview-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:20px}.overview-metric,.overview-glass{background:var(--card);border:1px solid var(--border);border-radius:20px;box-shadow:0 8px 28px #2440370b;backdrop-filter:blur(22px)}.overview-metric{position:relative;padding:22px;display:flex;flex-direction:column;gap:10px;transition:transform .2s,box-shadow .2s}.overview-metric:hover{transform:translateY(-3px);box-shadow:0 14px 28px #24403716}.overview-metric>span:not(.metric-icon){font-size:12px;font-weight:600;max-width:75%}.overview-metric strong{font-size:36px;letter-spacing:-1.4px;color:var(--ink);font-weight:750}.overview-metric small{font-size:11px;color:var(--muted)}.metric-icon{position:absolute;right:18px;top:18px;display:grid;place-items:center;width:28px;height:28px;background:#d8e8df;color:#28624f;border-radius:9px;font-size:16px}.metric-warning .metric-icon{background:#f3e1c9;color:#8f5424}
    .overview-charts{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(240px,1fr);gap:20px}.overview-glass{padding:25px;min-width:0}.period-pill{border:1px solid #6b8b7d45;border-radius:20px;padding:7px 10px;font-size:11px;white-space:nowrap;color:var(--muted)}.sales-amount{display:flex;align-items:center;gap:20px;margin:22px 0 8px}.sales-amount>strong{font-size:clamp(27px,3vw,39px);letter-spacing:-1.5px;color:var(--ink)}.sales-amount>span{font-size:11px;line-height:1.7;color:var(--muted);border-left:1px solid #6c867b55;padding-left:20px}.weekly-chart{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:12px;margin-top:15px}.day-column{text-align:center;min-width:0}.day-track{height:180px;border-bottom:1px solid #6c867b40;display:flex;justify-content:flex-end;align-items:center;flex-direction:column;gap:8px;background:repeating-linear-gradient(to top,transparent 0,transparent 44px,#6c867b12 44px,#6c867b12 45px)}.day-amount{font-size:10px;font-weight:650;color:var(--muted)}.day-bar{flex:none;width:min(70%,42px);border-radius:9px 9px 0 0;background:linear-gradient(180deg,#5a9d8a,#2d7060);box-shadow:0 8px 18px #32725d1c;transition:height .45s ease}.day-bar-today{background:linear-gradient(180deg,#b282c5,#75438e)}.day-label{display:block;font-size:12px;font-weight:700;margin-top:10px;color:var(--ink)}.day-column>small{font-size:10px;color:var(--muted)}.chart-footnote{font-size:10px;margin-top:20px}.inventory-health h3{margin-bottom:20px}.stock-ring{width:176px;height:176px;margin:15px auto 23px;border-radius:50%;display:grid;place-items:center;box-shadow:0 8px 22px #1e493214}.stock-ring>div{width:143px;height:143px;border-radius:50%;background:var(--ring-center);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px}.stock-ring strong{font-size:35px;letter-spacing:-1px}.stock-ring strong span{font-size:17px}.stock-ring small{font-size:10px;color:var(--muted)}.stock-legend{display:flex;flex-direction:column;gap:13px;font-size:11px;margin-bottom:22px}.stock-legend>span{display:flex;align-items:center;gap:8px}.stock-legend b{margin-left:auto}.stock-legend i{width:8px;height:8px;border-radius:50%;display:inline-block}.legend-available{background:#40867a}.legend-low{background:#d6a264}.overview-action{display:flex;justify-content:space-between;color:var(--ink);text-decoration:none;border-top:1px solid #6c867b30;padding-top:16px;font-weight:700;font-size:12px}.overview-bottom{display:flex;justify-content:space-between;align-items:center;gap:16px;font-size:10px;color:var(--muted);margin-top:24px}.overview-bottom i{display:inline-block;width:6px;height:6px;background:#40867a;border-radius:50%;margin-right:7px}.overview-bottom a{color:var(--ink);font-size:12px;text-decoration:none;font-weight:700}.loading-overview{padding:40px;text-align:center;color:var(--muted)}
    :host-context(.is-dark) .business-overview{--ink:#eef4ed;--muted:#c2d5ce;--card:rgba(31,60,57,.78);--border:rgba(170,201,187,.2);--ring-center:#203c38;background:radial-gradient(ellipse at 0% 0%,#42634c70,transparent 55%),radial-gradient(ellipse at 100% 80%,#61447844,transparent 55%),#142c2a;border-color:#6b8b7d45}:host-context(.is-dark) .metric-icon{background:#3c6455;color:#e0f3e4}:host-context(.is-dark) .metric-warning .metric-icon{background:#756044;color:#ffe0ae}
    @media(max-width:1050px){.overview-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.overview-charts{grid-template-columns:1fr}.inventory-health{display:grid;grid-template-columns:1fr 1fr;align-items:center;column-gap:25px}.inventory-health .eyebrow,.inventory-health h3,.inventory-health .overview-action{grid-column:1/-1}.stock-ring{margin:12px auto}.stock-legend{margin:0}}@media(max-width:600px){.business-overview{padding:17px}.overview-heading{align-items:flex-start}.overview-heading button{font-size:10px;padding:9px}.overview-metric{padding:17px}.overview-metric strong{font-size:30px}.metric-icon{right:11px;top:12px}.overview-metrics{gap:10px}.overview-glass{padding:17px}.weekly-chart{gap:5px}.day-amount{font-size:8px}.sales-amount{gap:10px}.sales-amount>span{padding-left:10px}.overview-bottom{align-items:flex-start}.stock-ring{width:145px;height:145px}.stock-ring>div{width:117px;height:117px}.inventory-health{column-gap:12px}.chart-heading{gap:8px}.period-pill{font-size:9px}}
    @media(prefers-reduced-motion:reduce){.overview-metric,.day-bar{transition:none}}
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly api=inject(ApiService);
  private intervalo?: ReturnType<typeof setInterval>;
  private consulta?: Subscription;
  productos=0; stockBajo=0; clientes=0; ventas=0; unidadesSemana=0;
  cargando=false; cargado=false; error=''; actualizado?:Date;
  dias:Array<{fecha:string;total:number}>=[];
  nombreDia(fecha:string):string{return new Date(fecha+'T12:00:00').toLocaleDateString('es-PE',{weekday:'short'});}
  get hoy():string{return this.fechaLocal(new Date());}
  get maximo():number{return Math.max(1,...this.dias.map(d=>d.total));}
  get totalSemana():number{return this.dias.reduce((n,d)=>n+d.total,0);}
  get porcentajeDisponible():number{return this.productos?(this.productos-this.stockBajo)/this.productos*100:0;}
  get anillo():string{return 'conic-gradient(#40867a 0% '+this.porcentajeDisponible+'%,#d6a264 '+this.porcentajeDisponible+'% 100%)';}
  ngOnInit():void{this.cargar();this.intervalo=setInterval(()=>this.cargar(),30000);}
  ngOnDestroy():void{clearInterval(this.intervalo);this.consulta?.unsubscribe();}
  private fechaLocal(d:Date):string{return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
  cargar():void {
    if(this.cargando)return;this.cargando=true;
    this.consulta=forkJoin([this.api.productos(),this.api.clientes(),this.api.ventas()]).subscribe({
      next:([productos,clientes,ventas])=>{
        const emitidas=ventas.filter(v=>v.estado==='EMITIDA');
        this.productos=productos.filter(p=>p.activo!==false).length;
        this.stockBajo=productos.filter(p=>p.activo!==false&&p.stock<=5).length;
        this.clientes=clientes.filter(c=>c.activo!==false).length;this.ventas=emitidas.length;
        this.dias=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const fecha=this.fechaLocal(d);return {fecha,total:emitidas.filter(v=>v.fecha.slice(0,10)===fecha).reduce((n,v)=>n+Number(v.total),0)};});
        const fechas=new Set(this.dias.map(d=>d.fecha));this.unidadesSemana=emitidas.filter(v=>fechas.has(v.fecha.slice(0,10))).flatMap(v=>v.detalles||[]).reduce((n,d)=>n+d.cantidad,0);
        this.cargando=false;this.cargado=true;this.error='';this.actualizado=new Date();
      },error:()=>{this.cargando=false;this.error=this.cargado?'No se pudieron actualizar los datos. Se conserva la última consulta.':'No se pudieron consultar los indicadores. Verifique los servicios del backend.';}
    });
  }
}
