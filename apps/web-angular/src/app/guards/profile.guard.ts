import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { ProfileService } from '../core/profile.service';

export const profileGuard: CanActivateFn = () => {
  const profiles = inject(ProfileService);
  const router = inject(Router);
  return profiles.activeProfile() ? true : router.parseUrl('/profiles');
};
