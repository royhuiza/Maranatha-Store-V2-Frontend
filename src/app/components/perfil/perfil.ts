import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['./perfil.css'], templateUrl: './perfil.html'
})
export class ProfileComponent {
  readonly auth = inject(AuthService);
  readonly rol = localStorage.getItem('rol') || 'ADMIN';
}
