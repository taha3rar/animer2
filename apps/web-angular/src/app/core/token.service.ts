import { Injectable } from '@angular/core';

const ACCESS_KEY = 'streaming.accessToken';
const REFRESH_KEY = 'streaming.refreshToken';

/** Access/refresh token storage — localStorage-backed, same keys the old
 * shared @streaming/api-client's LocalStorageTokenStore used, so an existing
 * logged-in session survives the switch to HttpClient. */
@Injectable({ providedIn: 'root' })
export class TokenService {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  }

  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }
}
