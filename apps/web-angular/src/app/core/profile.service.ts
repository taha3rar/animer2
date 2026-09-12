import { Injectable, signal } from '@angular/core';
import type { Profile } from '@streaming/types';

const STORAGE_KEY = 'streaming.activeProfile';

function readPersisted(): Profile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

// Persisted so the TV doesn't ask "who's watching" every single time the app
// opens — mirrors apps/web/src/store/useProfileStore.ts (zustand + persist).
@Injectable({ providedIn: 'root' })
export class ProfileService {
  activeProfile = signal<Profile | null>(readPersisted());

  setActiveProfile(profile: Profile): void {
    this.activeProfile.set(profile);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }

  clearActiveProfile(): void {
    this.activeProfile.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }
}
