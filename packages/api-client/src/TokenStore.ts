// Pluggable so the browser/webOS client can use localStorage while a future
// Android TV client (or any other host) can back this with its own secure storage.
export interface TokenStore {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(accessToken: string, refreshToken: string): void;
  clear(): void;
}

export class MemoryTokenStore implements TokenStore {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  getAccessToken() {
    return this.accessToken;
  }
  getRefreshToken() {
    return this.refreshToken;
  }
  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }
  clear() {
    this.accessToken = null;
    this.refreshToken = null;
  }
}

const ACCESS_KEY = "streaming.accessToken";
const REFRESH_KEY = "streaming.refreshToken";

export class LocalStorageTokenStore implements TokenStore {
  getAccessToken() {
    return localStorage.getItem(ACCESS_KEY);
  }
  getRefreshToken() {
    return localStorage.getItem(REFRESH_KEY);
  }
  setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  }
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
}
