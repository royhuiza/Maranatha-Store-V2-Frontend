import { ThemePreference } from '../../core/theme-preference';
import { OriginkitSceneComponent } from '../../core/originkit-scene.component';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { ApiError } from '../../models';

@Component({
  standalone: true,
  imports: [OriginkitSceneComponent, CommonModule, FormsModule, RouterLink],
  styleUrls: ['./login.css'], templateUrl: './login.html'
})
export class LoginComponent {
  usuario = '';
  clave = '';
  error = '';
  cargando = false;
  mostrarClave = false;
  readonly theme = inject(ThemePreference);
  readonly view = inject(ChangeDetectorRef);

  onLogoError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  entrar(): void {
    if (!this.usuario.trim() || !this.clave || this.cargando) return;
    this.error = '';
    this.cargando = true;
    this.auth.login(this.usuario.trim(), this.clave).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (error: HttpErrorResponse) => {
        const body = error.error as ApiError;
        this.error = body?.message || (error.status === 0
          ? 'No se puede conectar con el servidor. Comprueba que el backend esté encendido.'
          : 'Usuario o contraseña incorrectos.');
        this.cargando = false;
      }
    });
  }
}
