import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { FocusableDirective } from '../tv/focusable.directive';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, FocusableDirective],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPageComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  username = '';
  password = '';
  error = signal<string | null>(null);
  loading = signal(false);

  async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.auth.login(this.username, this.password);
      this.router.navigateByUrl('/profiles', { replaceUrl: true });
    } catch (err) {
      this.error.set(
        err instanceof HttpErrorResponse
          ? (err.error?.message ?? err.message)
          : 'Could not log in. Check the API is running.'
      );
    } finally {
      this.loading.set(false);
    }
  }
}
