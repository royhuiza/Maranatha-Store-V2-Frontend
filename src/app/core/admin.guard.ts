import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';
export const adminGuard: CanActivateFn = () => inject(AuthService).isAdmin || inject(Router).createUrlTree(['/']);
