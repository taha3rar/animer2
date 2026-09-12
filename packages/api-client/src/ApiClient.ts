import type {
  AnizoneEpisode,
  AnizoneSearchResult,
  AuthenticatedUser,
  ContinueWatchingItem,
  Episode,
  EpisodeContext,
  FavoriteEntry,
  Movie,
  PlaybackProgress,
  Profile,
  ProfilePreferences,
  Season,
  Series,
  WatchHistoryEntry,
  WatchlistEntry,
} from "@streaming/types";
import type { TokenStore } from "./TokenStore";
import { MemoryTokenStore } from "./TokenStore";

export type SeriesDetail = Series & {
  seasons: (Season & { episodes: Episode[] })[];
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export class ApiClient {
  private baseUrl: string;
  private tokenStore: TokenStore;
  private refreshInFlight: Promise<void> | null = null;

  constructor(baseUrl: string, tokenStore: TokenStore = new MemoryTokenStore()) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.tokenStore = tokenStore;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    retry = true
  ): Promise<T> {
    const accessToken = this.tokenStore.getAccessToken();
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });

    if (res.status === 401 && retry && this.tokenStore.getRefreshToken()) {
      await this.refreshAccessToken();
      return this.request<T>(path, init, false);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new ApiError(res.status, body || res.statusText);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = (async () => {
        const refreshToken = this.tokenStore.getRefreshToken();
        const res = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          this.tokenStore.clear();
          throw new ApiError(res.status, "Session expired");
        }
        const data = await res.json();
        this.tokenStore.setTokens(data.accessToken, data.refreshToken);
      })();
      try {
        await this.refreshInFlight;
      } finally {
        this.refreshInFlight = null;
      }
    } else {
      await this.refreshInFlight;
    }
  }

  isAuthenticated(): boolean {
    return !!this.tokenStore.getAccessToken();
  }

  logoutLocally(): void {
    this.tokenStore.clear();
  }

  // --- Auth ---

  async login(email: string, password: string): Promise<AuthenticatedUser> {
    const data = await this.request<{
      accessToken: string;
      refreshToken: string;
      user: AuthenticatedUser;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.tokenStore.setTokens(data.accessToken, data.refreshToken);
    return data.user;
  }

  async logout(): Promise<void> {
    const refreshToken = this.tokenStore.getRefreshToken();
    try {
      await this.request("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
    } finally {
      this.tokenStore.clear();
    }
  }

  // --- Profiles ---

  getProfiles(): Promise<Profile[]> {
    return this.request("/profiles");
  }

  createProfile(input: { name: string; avatarUrl?: string; isKidsProfile?: boolean }): Promise<Profile> {
    return this.request("/profiles", { method: "POST", body: JSON.stringify(input) });
  }

  updateProfile(id: string, input: Partial<{ name: string; avatarUrl: string }>): Promise<Profile> {
    return this.request(`/profiles/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  }

  deleteProfile(id: string): Promise<void> {
    return this.request(`/profiles/${id}`, { method: "DELETE" });
  }

  // --- Content ---

  getSeriesList(): Promise<Series[]> {
    return this.request("/series");
  }

  getSeriesDetail(id: string): Promise<SeriesDetail> {
    return this.request(`/series/${id}`);
  }

  getMovies(): Promise<Movie[]> {
    return this.request("/movies");
  }

  getMovie(id: string): Promise<Movie> {
    return this.request(`/movies/${id}`);
  }

  getEpisode(id: string): Promise<Episode> {
    return this.request(`/episodes/${id}`);
  }

  getEpisodeContext(id: string): Promise<EpisodeContext> {
    return this.request(`/episodes/${id}/context`);
  }

  // --- Discovery (AniZone metadata search/import) ---

  searchAnizone(q: string): Promise<AnizoneSearchResult> {
    return this.request(`/discovery/anizone/search?q=${encodeURIComponent(q)}`);
  }

  importAnizoneSeries(input: {
    slug: string;
    title: string;
    sourceUrl?: string;
    coverUrl?: string;
    startYear?: number;
  }): Promise<Series> {
    return this.request("/discovery/anizone/import", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  getAnizoneEpisodes(slug: string): Promise<AnizoneEpisode[]> {
    return this.request(`/discovery/anizone/${encodeURIComponent(slug)}/episodes`);
  }

  // Resolves one episode on demand (Mongo find-or-scrape server-side) — call
  // this right before navigating to it, not as a bulk upfront import.
  resolveAnizoneEpisode(seriesId: string, episodeNumber: number): Promise<Episode> {
    return this.request(`/discovery/anizone/series/${seriesId}/episode/${episodeNumber}`, {
      method: "POST",
    });
  }

  // --- Profile-scoped: progress / watchlist / favorites / history / preferences ---

  getContinueWatching(profileId: string): Promise<ContinueWatchingItem[]> {
    return this.request(`/profiles/${profileId}/progress`);
  }

  saveProgress(
    profileId: string,
    input: {
      episodeId?: string;
      movieId?: string;
      positionSeconds: number;
      durationSeconds: number;
    }
  ): Promise<PlaybackProgress> {
    return this.request(`/profiles/${profileId}/progress`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }

  getWatchlist(profileId: string): Promise<WatchlistEntry[]> {
    return this.request(`/profiles/${profileId}/watchlist`);
  }

  addToWatchlist(profileId: string, input: { seriesId?: string; movieId?: string }): Promise<WatchlistEntry> {
    return this.request(`/profiles/${profileId}/watchlist`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  removeFromWatchlist(profileId: string, entryId: string): Promise<void> {
    return this.request(`/profiles/${profileId}/watchlist/${entryId}`, { method: "DELETE" });
  }

  getFavorites(profileId: string): Promise<FavoriteEntry[]> {
    return this.request(`/profiles/${profileId}/favorites`);
  }

  addFavorite(profileId: string, input: { seriesId?: string; movieId?: string }): Promise<FavoriteEntry> {
    return this.request(`/profiles/${profileId}/favorites`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  removeFavorite(profileId: string, entryId: string): Promise<void> {
    return this.request(`/profiles/${profileId}/favorites/${entryId}`, { method: "DELETE" });
  }

  getHistory(profileId: string): Promise<WatchHistoryEntry[]> {
    return this.request(`/profiles/${profileId}/history`);
  }

  getPreferences(profileId: string): Promise<ProfilePreferences> {
    return this.request(`/profiles/${profileId}/preferences`);
  }

  updatePreferences(
    profileId: string,
    input: Partial<Omit<ProfilePreferences, "profileId">>
  ): Promise<ProfilePreferences> {
    return this.request(`/profiles/${profileId}/preferences`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }
}
