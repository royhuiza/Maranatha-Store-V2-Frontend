import { OriginkitSceneComponent } from './core/originkit-scene.component';
import { AmbientSceneComponent } from './core/ambient-scene.component';
import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, ViewChild, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AuthService } from './core/auth.service';

type SectionId = 'inicio' | 'productos' | 'clientes' | 'ventas' | 'reportes' | 'cuenta';

interface SectionVisual {
  id: SectionId;
  eyebrow: string;
  title: string;
  description: string;
}

@Component({
  standalone: true,
  imports: [OriginkitSceneComponent, AmbientSceneComponent, CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="layout maranatha-app" [class.is-dark]="darkMode" [class.steep-home]="section.id === 'inicio'"
      [class.workspace-data]="section.id === 'productos' || section.id === 'clientes' || section.id === 'cuenta'"
      [class.workspace-analytics]="section.id === 'ventas' || section.id === 'reportes'">
      <aside>
        <div class="brand brand-official"><img class="maranatha-brand-image sidebar-brand-image" src="/maranatha-logo.png" alt="Librería Maranatha" (error)="onLogoError($event)"><div class="brand-fallback"><b>Maranatha</b><small>Store</small></div></div>
        <nav aria-label="Navegación principal">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}"><span class="nav-icon" aria-hidden="true">⌂</span><span class="nav-label">Inicio</span></a>
          <a routerLink="/productos" routerLinkActive="active"><span class="nav-icon" aria-hidden="true">▤</span><span class="nav-label">Productos y stock</span></a>
          <a routerLink="/clientes" routerLinkActive="active"><span class="nav-icon" aria-hidden="true">♙</span><span class="nav-label">Clientes</span></a>
          <a routerLink="/ventas" routerLinkActive="active"><span class="nav-icon" aria-hidden="true">◇</span><span class="nav-label">Ventas y facturación</span></a>
          <a *ngIf="auth.isAdmin" routerLink="/usuarios" routerLinkActive="active"><span class="nav-icon" aria-hidden="true">♙</span><span class="nav-label">Usuarios y roles</span></a>
          <a *ngIf="auth.isAdmin" routerLink="/reportes" routerLinkActive="active"><span class="nav-icon" aria-hidden="true">▥</span><span class="nav-label">Reportes Excel</span></a>
        </nav>
        <div class="sidebar-bottom"><span>MARANATHA STORE / V2</span>Gestión de tu librería, en un solo lugar.</div>
      </aside>
      <main class="app-main">
        <header class="app-topbar">
          <div><h1>{{auth.isAdmin ? 'Panel de administración' : 'Mi espacio de ventas'}}</h1><p>{{auth.isAdmin ? 'Inventario, clientes, ventas y usuarios' : 'Consulta productos y registra tus ventas'}}</p></div>
          <div class="topbar-actions">
            <button type="button" class="theme-toggle" (click)="toggleTheme()"
              [attr.aria-label]="darkMode ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'"
              [attr.aria-pressed]="darkMode" [title]="darkMode ? 'Tema claro' : 'Tema oscuro'">
              <svg *ngIf="!darkMode" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M20.4 15.5A8 8 0 0 1 8.5 3.6a8.2 8.2 0 1 0 11.9 11.9Z"/></svg>
              <svg *ngIf="darkMode" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>
              <span>{{ darkMode ? 'Claro' : 'Oscuro' }}</span>
            </button>
            <div class="user-menu" #userMenu>
              <button type="button" class="user-menu-toggle" (click)="toggleMenu()" [attr.aria-expanded]="showMenu">
                {{ auth.username }} <span class="chevron">▾</span>
              </button>
              <div class="user-menu-panel" *ngIf="showMenu">
                <a routerLink="/perfil" routerLinkActive="active" (click)="closeMenu()">Editar perfil</a>
                <a routerLink="/cambiar-contrasena" routerLinkActive="active" (click)="closeMenu()">Cambiar contraseña</a>
                <button type="button" class="logout secondary" (click)="logout()">Cerrar sesión</button>
              </div>
            </div>
          </div>
        </header>
        <section class="content maranatha-content">
          <section class="section-hero" [attr.data-section]="section.id" aria-label="Sección actual">
            <app-originkit-scene *ngIf="showRibbons; else sectionAmbient" effect="ribbons" />
            <ng-template #sectionAmbient><app-ambient-scene /></ng-template>
            <div class="hero-text">
              <span class="hero-eyebrow"><span class="hero-signal"></span>{{ section.eyebrow }}</span>
              <h2>{{ section.title }}</h2>
              <p>{{ section.description }}</p>
            </div>
            <div class="hero-art" *ngIf="section.id !== 'inicio'" aria-hidden="true">
              <svg viewBox="0 0 320 168" role="presentation" xmlns="http://www.w3.org/2000/svg">
                <circle cx="225" cy="72" r="72" fill="#ffffff" opacity=".085"/>
                <circle cx="276" cy="120" r="25" fill="#F3C281" opacity=".2"/>
                <g *ngIf="section.id === 'productos'">
                  <rect x="116" y="27" width="116" height="132" rx="11" fill="#F3C281" transform="rotate(-9 116 27)"/>
                  <rect x="147" y="20" width="110" height="133" rx="10" fill="#FAF6EC" transform="rotate(7 147 20)"/>
                  <rect x="179" y="37" width="92" height="116" rx="10" fill="#214F4C"/>
                  <path d="M195 69h57M195 84h43M195 100h52" stroke="#C1D6C9" stroke-width="5" stroke-linecap="round"/>
                  <rect x="191" y="119" width="55" height="16" rx="8" fill="#F3C281"/>
                </g>
                <g *ngIf="section.id === 'clientes'">
                  <rect x="129" y="24" width="139" height="131" rx="18" fill="#FAF5E9"/>
                  <circle cx="199" cy="73" r="23" fill="#E5B278"/>
                  <path d="M159 134c2-22 15-33 40-33s39 11 40 33" fill="#417976"/>
                  <rect x="107" y="70" width="40" height="55" rx="9" fill="#E7BD85"/>
                  <circle cx="127" cy="91" r="9" fill="#fff3e0"/><path d="M117 114q10-12 20 0" fill="#fff3e0"/>
                </g>
                <g *ngIf="section.id === 'ventas'">
                  <path d="M126 27h130v125l-12-8-14 8-14-8-14 8-14-8-14 8-14-8-14 8V27Z" fill="#FAF5E9"/>
                  <path d="M149 54h79M149 68h53M149 90h75" stroke="#B5CFC4" stroke-width="6" stroke-linecap="round"/>
                  <path d="M149 119h46" stroke="#214F4C" stroke-width="8" stroke-linecap="round"/>
                  <circle cx="241" cy="114" r="26" fill="#E6AB60"/><path d="M228 114h26M241 102v24" stroke="#214F4C" stroke-width="5" stroke-linecap="round"/>
                </g>
                <g *ngIf="section.id === 'reportes'">
                  <rect x="126" y="23" width="133" height="135" rx="13" fill="#FAF5E9"/>
                  <rect x="146" y="44" width="91" height="9" rx="4" fill="#B5CFC4"/>
                  <path d="M153 137V99" stroke="#5A9890" stroke-width="19" stroke-linecap="round"/>
                  <path d="M183 137V75" stroke="#E7AD6D" stroke-width="19" stroke-linecap="round"/>
                  <path d="M213 137V90" stroke="#214F4C" stroke-width="19" stroke-linecap="round"/>
                </g>
                <g *ngIf="section.id === 'cuenta'">
                  <circle cx="190" cy="82" r="63" fill="#FAF5E9"/>
                  <circle cx="190" cy="66" r="23" fill="#E8B377"/>
                  <path d="M149 127q7-40 41-40t41 40" fill="#376C68"/>
                  <path d="M140 60l-13 12 13 12" stroke="#F3C281" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
                </g>
              </svg>
            </div>
          </section>
          <div class="route-stage">
            <div class="route-wipe" *ngIf="showWipe" aria-hidden="true"></div>
            <router-outlet/>
          </div>
        </section>
      </main>
    </div>
  `
})
export class ShellComponent implements OnDestroy {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly rol = localStorage.getItem('rol') || 'ADMIN';
  darkMode = localStorage.getItem('maranatha-ui-mode') === 'dark';
  showMenu = false;
  showWipe = false;
  private wipeTimer?: ReturnType<typeof setTimeout>;
  private readonly navigationSubscription: Subscription;

  @ViewChild('userMenu', { read: ElementRef }) userMenu?: ElementRef<HTMLElement>;

  constructor() {
    this.auth.refrescarSesion();
    this.navigationSubscription = this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => {
      this.closeMenu();
      this.showWipe = false;
      if (this.wipeTimer) clearTimeout(this.wipeTimer);
      // Programar una nueva capa permite reiniciar la animación en cada navegación.
      this.wipeTimer = setTimeout(() => {
        this.showWipe = true;
        this.wipeTimer = setTimeout(() => this.showWipe = false, 720);
      }, 0);
    });
  }

  get showRibbons(): boolean {
    return ['inicio', 'ventas', 'reportes'].includes(this.section.id);
  }

  get section(): SectionVisual {
    const path = this.router.url.split('?')[0].split('/')[1] || '';
    const sections: Record<string, SectionVisual> = {
      productos: { id: 'productos', eyebrow: 'CATÁLOGO / INVENTARIO', title: 'Cada artículo, bajo control.', description: 'Gestiona productos, precios y existencias desde una sola pantalla.' },
      clientes: { id: 'clientes', eyebrow: 'PERSONAS / EMPRESAS', title: 'Clientes más cerca.', description: 'La información de cada cliente, clara y siempre a mano.' },
      ventas: { id: 'ventas', eyebrow: 'VENTAS / COMPROBANTES', title: 'Ventas sin complicaciones.', description: 'Registra artículos, revisa importes y organiza comprobantes.' },
      reportes: { id: 'reportes', eyebrow: 'REPORTES / DATOS', title: 'Tus números, en perspectiva.', description: 'Consulta y exporta los datos de tu librería.' },
      usuarios: { id: 'cuenta', eyebrow: 'EQUIPO / PERMISOS', title: 'Usuarios y roles.', description: 'Administra las cuentas y permisos de tu equipo.' },
      perfil: { id: 'cuenta', eyebrow: 'CUENTA / SEGURIDAD', title: 'Tu cuenta, tu espacio.', description: 'Actualiza tus datos de manera segura.' },
      'cambiar-contrasena': { id: 'cuenta', eyebrow: 'CUENTA / SEGURIDAD', title: 'Tu acceso, protegido.', description: 'Gestiona la seguridad de tu cuenta.' }
    };
    return sections[path] || { id: 'inicio', eyebrow: 'BIENVENIDO / MARANATHA STORE', title: 'El pulso de tu librería.', description: 'Ventas, inventario y clientes en una sola vista.' };
  }

  onLogoError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  toggleTheme(): void {
    this.darkMode = !this.darkMode;
    localStorage.setItem('maranatha-ui-mode', this.darkMode ? 'dark' : 'light');
  }

  toggleMenu(): void { this.showMenu = !this.showMenu; }
  closeMenu(): void { this.showMenu = false; }
  logout(): void { this.auth.logout(); this.closeMenu(); }

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: HTMLElement): void {
    const menuElement = this.userMenu?.nativeElement;
    if (this.showMenu && menuElement && !menuElement.contains(target)) this.closeMenu();
  }

  ngOnDestroy(): void {
    if (this.wipeTimer) clearTimeout(this.wipeTimer);
    this.navigationSubscription.unsubscribe();
  }
}
