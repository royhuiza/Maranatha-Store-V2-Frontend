import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../services/auth";
export const authGuard: CanActivateFn = () =>
  inject(AuthService).isLogged() || inject(Router).createUrlTree(["/login"]);
