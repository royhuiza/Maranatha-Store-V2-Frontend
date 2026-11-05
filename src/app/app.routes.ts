import { localMailboxGuard } from './core/local-mailbox';
import { LocalMailboxComponent } from './pages/local-mailbox.component';
import { adminGuard } from './core/admin.guard';
import { UsuariosComponent } from './pages/usuarios.component';
import { Routes } from "@angular/router";
import { authGuard } from "./core/auth.guard";
import { LoginComponent } from "./pages/login.component";
import { PasswordRecoveryComponent } from "./pages/password-recovery.component";
import { ShellComponent } from "./shell.component";
import { DashboardComponent } from "./pages/dashboard.component";
import { ProductosComponent } from "./pages/productos.component";
import { ClientesComponent } from "./pages/clientes.component";
import { VentasComponent } from "./pages/ventas.component";
import { ReportesComponent } from "./pages/reportes.component";
import { ProfileComponent } from "./pages/profile.component";
import { ChangePasswordComponent } from "./pages/change-password.component";
export const routes: Routes = [
  { path: "buzon-pruebas", component: LocalMailboxComponent, canActivate: [localMailboxGuard] },
  { path: "login", component: LoginComponent },
  { path: "recuperar-contrasena", component: PasswordRecoveryComponent },
  {
    path: "",
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: "", component: DashboardComponent },
      { path: "productos", component: ProductosComponent },
      { path: "clientes", component: ClientesComponent },
      { path: "ventas", component: VentasComponent },
      { path: "reportes", component: ReportesComponent, canActivate: [adminGuard] },
      { path: "usuarios", component: UsuariosComponent, canActivate: [adminGuard] },
      { path: "perfil", component: ProfileComponent },
      { path: "cambiar-contrasena", component: ChangePasswordComponent },
    ],
  },
  { path: "**", redirectTo: "" },
];
