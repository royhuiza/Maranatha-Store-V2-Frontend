import { localMailboxGuard } from './core/local-mailbox';
import { adminGuard } from './core/admin.guard';
import { Routes } from "@angular/router";
import { authGuard } from "./core/auth.guard";
import { LoginComponent } from "./pages/login.component";
export const routes: Routes = [
  { path: "buzon-pruebas", loadComponent: () => import('./pages/local-mailbox.component').then(m => m.LocalMailboxComponent), canActivate: [localMailboxGuard] },
  { path: "login", component: LoginComponent },
  { path: "recuperar-contrasena", loadComponent: () => import('./pages/password-recovery.component').then(m => m.PasswordRecoveryComponent) },
  {
    path: "",
    loadComponent: () => import('./shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: "", loadComponent: () => import('./pages/dashboard.component').then(m => m.DashboardComponent) },
      { path: "productos", loadComponent: () => import('./pages/productos.component').then(m => m.ProductosComponent) },
      { path: "clientes", loadComponent: () => import('./pages/clientes.component').then(m => m.ClientesComponent) },
      { path: "ventas", loadComponent: () => import('./pages/ventas.component').then(m => m.VentasComponent) },
      { path: "reportes", loadComponent: () => import('./pages/reportes.component').then(m => m.ReportesComponent), canActivate: [adminGuard] },
      { path: "usuarios", loadComponent: () => import('./pages/usuarios.component').then(m => m.UsuariosComponent), canActivate: [adminGuard] },
      { path: "perfil", loadComponent: () => import('./pages/profile.component').then(m => m.ProfileComponent) },
      { path: "cambiar-contrasena", loadComponent: () => import('./pages/change-password.component').then(m => m.ChangePasswordComponent) },
    ],
  },
  { path: "**", redirectTo: "" },
];
