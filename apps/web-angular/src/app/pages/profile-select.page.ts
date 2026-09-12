import { AfterViewInit, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Profile } from '@streaming/types';
import { ApiService } from '../core/api.service';
import { ProfileService } from '../core/profile.service';
import { FocusableDirective } from '../tv/focusable.directive';
import { autoFocus } from '../tv/auto-focus';

@Component({
  selector: 'app-profile-select-page',
  standalone: true,
  imports: [FocusableDirective],
  templateUrl: './profile-select.page.html',
  styleUrl: './profile-select.page.scss',
})
export class ProfileSelectPageComponent implements AfterViewInit {
  private api = inject(ApiService);
  private profileService = inject(ProfileService);
  private router = inject(Router);

  profiles = signal<Profile[]>([]);
  isLoading = signal(true);
  error = signal(false);

  async ngAfterViewInit(): Promise<void> {
    try {
      const profiles = await this.api.getProfiles();
      this.profiles.set(profiles);
    } catch {
      this.error.set(true);
    } finally {
      this.isLoading.set(false);
      autoFocus();
    }
  }

  choose(profile: Profile): void {
    this.profileService.setActiveProfile(profile);
    this.router.navigateByUrl('/', { replaceUrl: true });
  }
}
