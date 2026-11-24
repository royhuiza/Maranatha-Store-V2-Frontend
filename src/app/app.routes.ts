import { localMailboxGuard } from './core/local-mailbox';
import { adminGuard } from './core/admin.guard';
import { Routes } from "@angular/router";
import { authGuard } from "./core/auth.guard";
import { LoginComponent } from "./components/login/login";
export const routes: Routes = [
  { path: "buzon-pruebas", loadComponent: () => import('./components/buzon/buzon').then(m => m.LocalMailboxComponent), canActivate: [localMailboxGuard] },
  { path: "login", component: LoginComponent },
  { path: "recuperar-contrasena", loadComponent: () => import('./components/recuperarcontrasena/recuperarcontrasena').then(m => m.PasswordRecoveryComponent) },
  {
    path: "",
    loadComponent: () => import('./shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: 'clientes', loadComponent: () => import('./pages/clientes.component').then(m => m.ClientesComponent) },
      { path: 'chatbot', loadComponent: () => import('./pages/chatbot-logs.component').then(m => m.ChatbotLogsComponent), canActivate: [adminGuard] },
      { path: "", loadComponent: () => import('./pages/dashboard.component').then(m => m.DashboardComponent) },
      { path: "productos", loadComponent: () => import('./pages/productos.component').then(m => m.ProductosComponent) },
      { path: "ventas", loadComponent: () => import('./components/venta/venta').then(m => m.VentasComponent) },
      { path: "reportes", loadComponent: () => import('./pages/reportes.component').then(m => m.ReportesComponent), canActivate: [adminGuard] },
      { path: "usuarios", loadComponent: () => import('./components/usuario/usuario').then(m => m.UsuariosComponent), canActivate: [adminGuard] },
      { path: "perfil", loadComponent: () => import('./components/perfil/perfil').then(m => m.ProfileComponent) },
      { path: "cambiar-contrasena", loadComponent: () => import('./components/cambiarcontrasena/cambiarcontrasena').then(m => m.ChangePasswordComponent) },
    ],
  },
  { path: "**", redirectTo: "" },
];
