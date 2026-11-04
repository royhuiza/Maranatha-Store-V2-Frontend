import { Routes } from "@angular/router";
import { authGuard } from "./core/auth.guard";
import { LoginComponent } from "./pages/login.component";
import { ShellComponent } from "./shell.component";
import { DashboardComponent } from "./pages/dashboard.component";
import { ProductosComponent } from "./pages/productos.component";
import { ClientesComponent } from "./pages/clientes.component";
import { VentasComponent } from "./pages/ventas.component";
import { ReportesComponent } from "./pages/reportes.component";
import { ProfileComponent } from "./pages/profile.component";
import { ChangePasswordComponent } from "./pages/change-password.component";
import { ChatbotLogsComponent } from "./pages/chatbot-logs.component";
export const routes: Routes = [
  { path: "login", component: LoginComponent },
  {
    path: "",
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: "", component: DashboardComponent },
      { path: "productos", component: ProductosComponent },
      { path: "clientes", component: ClientesComponent },
      { path: "ventas", component: VentasComponent },
      { path: "reportes", component: ReportesComponent },
      { path: "chatbot-logs", component: ChatbotLogsComponent },
      { path: "perfil", component: ProfileComponent },
      { path: "cambiar-contrasena", component: ChangePasswordComponent },
    ],
  },
  { path: "**", redirectTo: "" },
];
