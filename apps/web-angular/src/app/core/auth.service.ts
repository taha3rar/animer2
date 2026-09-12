import { Injectable, inject, signal } from '@angular/core';
import type { AuthenticatedUser } from '@streaming/types';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);

  isAuthenticated = signal(this.api.isAuthenticated());
  user = signal<AuthenticatedUser | null>(null);

  async login(username: string, password: string): Promise<void> {
    const user = await this.api.login(username, password);
    this.user.set(user);
    this.isAuthenticated.set(true);
  }

  async logout(): Promise<void> {
    await this.api.logout();
    this.user.set(null);
    this.isAuthenticated.set(false);
  }
}
