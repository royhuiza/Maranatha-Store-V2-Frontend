import { inject, isDevMode } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export function localMailboxAvailable(): boolean {
  return isDevMode() && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
}
export const localMailboxGuard: CanActivateFn = () => localMailboxAvailable() || inject(Router).createUrlTree(['/login']);
