import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrls: ['./cambiarcontrasena.css'], templateUrl: './cambiarcontrasena.html'
})
export class ChangePasswordComponent {
  private readonly api = inject(ApiService);
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  error = '';
  success = '';
  saving = false;

  guardar(): void {
    this.error = '';
    this.success = '';

    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.error = 'Todos los campos son obligatorios.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error = 'La nueva contraseña y la confirmación no coinciden.';
      return;
    }

    if (this.newPassword.length < 10 || this.newPassword.length > 72) { this.error = 'Use entre 10 y 72 caracteres.'; return; }
    this.saving = true;
    this.api.cambiarPassword(this.currentPassword, this.newPassword).subscribe({
      next: () => { this.saving=false; this.success='Contraseña guardada en el servidor.'; this.currentPassword=''; this.newPassword=''; this.confirmPassword=''; },
      error: e => { this.saving=false; this.error=e.error?.message || 'No se pudo cambiar la contraseña.'; }
    });
  }
}
