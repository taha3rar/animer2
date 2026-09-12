import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
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
} from '@streaming/types';
import { API_BASE_URL } from './config';
import { TokenService } from './token.service';

export type SeriesDetail = Series & { seasons: (Season & { episodes: Episode[] })[] };

/**
 * Angular-native replacement for the old shared @streaming/api-client's
 * ApiClient — same endpoint surface, but built on HttpClient so auth
 * (attaching the token, refreshing on 401) is handled by authInterceptor
 * instead of hand-rolled fetch/retry logic, and requests get proper DI,
 * interceptor composition, and testability via HttpClientTestingModule.
 *
 * Public methods stay Promise-returning (via firstValueFrom) rather than
 * exposing Observables, so call sites can keep using async/await — only the
 * transport changed, not the calling convention.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private tokens = inject(TokenService);
  private baseUrl = API_BASE_URL;

  isAuthenticated(): boolean {
    return this.tokens.isAuthenticated();
  }

  logoutLocally(): void {
    this.tokens.clear();
  }

  // --- Auth ---

  async login(username: string, password: string): Promise<AuthenticatedUser> {
    const data = await firstValueFrom(
      this.http.post<{ accessToken: string; refreshToken: string; user: AuthenticatedUser }>(
        `${this.baseUrl}/auth/login`,
        { username, password }
      )
    );
    this.tokens.setTokens(data.accessToken, data.refreshToken);
    return data.user;
  }

  async logout(): Promise<void> {
    const refreshToken = this.tokens.getRefreshToken();
    try {
      await firstValueFrom(this.http.post(`${this.baseUrl}/auth/logout`, { refreshToken }));
    } finally {
      this.tokens.clear();
    }
  }

  // --- Profiles ---

  getProfiles(): Promise<Profile[]> {
    return firstValueFrom(this.http.get<Profile[]>(`${this.baseUrl}/profiles`));
  }

  createProfile(input: { name: string; avatarUrl?: string; isKidsProfile?: boolean }): Promise<Profile> {
    return firstValueFrom(this.http.post<Profile>(`${this.baseUrl}/profiles`, input));
  }

  updateProfile(id: string, input: Partial<{ name: string; avatarUrl: string }>): Promise<Profile> {
    return firstValueFrom(this.http.patch<Profile>(`${this.baseUrl}/profiles/${id}`, input));
  }

  deleteProfile(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.baseUrl}/profiles/${id}`));
  }

  // --- Content ---

  getSeriesList(): Promise<Series[]> {
    return firstValueFrom(this.http.get<Series[]>(`${this.baseUrl}/series`));
  }

  getSeriesDetail(id: string): Promise<SeriesDetail> {
    return firstValueFrom(this.http.get<SeriesDetail>(`${this.baseUrl}/series/${id}`));
  }

  getMovies(): Promise<Movie[]> {
    return firstValueFrom(this.http.get<Movie[]>(`${this.baseUrl}/movies`));
  }

  getMovie(id: string): Promise<Movie> {
    return firstValueFrom(this.http.get<Movie>(`${this.baseUrl}/movies/${id}`));
  }

  getEpisode(id: string): Promise<Episode> {
    return firstValueFrom(this.http.get<Episode>(`${this.baseUrl}/episodes/${id}`));
  }

  getEpisodeContext(id: string): Promise<EpisodeContext> {
    return firstValueFrom(this.http.get<EpisodeContext>(`${this.baseUrl}/episodes/${id}/context`));
  }

  // --- Discovery (AniZone metadata search/import) ---

  searchAnizone(q: string): Promise<AnizoneSearchResult> {
    return firstValueFrom(
      this.http.get<AnizoneSearchResult>(`${this.baseUrl}/discovery/anizone/search`, { params: { q } })
    );
  }

  importAnizoneSeries(input: {
    slug: string;
    title: string;
    sourceUrl?: string;
    coverUrl?: string;
    startYear?: number;
  }): Promise<Series> {
    return firstValueFrom(this.http.post<Series>(`${this.baseUrl}/discovery/anizone/import`, input));
  }

  getAnizoneEpisodes(slug: string): Promise<AnizoneEpisode[]> {
    return firstValueFrom(
      this.http.get<AnizoneEpisode[]>(`${this.baseUrl}/discovery/anizone/${encodeURIComponent(slug)}/episodes`)
    );
  }

  // Resolves one episode on demand (Mongo find-or-scrape server-side) — call
  // this right before navigating to it, not as a bulk upfront import.
  resolveAnizoneEpisode(seriesId: string, episodeNumber: number): Promise<Episode> {
    return firstValueFrom(
      this.http.post<Episode>(`${this.baseUrl}/discovery/anizone/series/${seriesId}/episode/${episodeNumber}`, {})
    );
  }

  // --- Profile-scoped: progress / watchlist / favorites / history / preferences ---

  getContinueWatching(profileId: string): Promise<ContinueWatchingItem[]> {
    return firstValueFrom(this.http.get<ContinueWatchingItem[]>(`${this.baseUrl}/profiles/${profileId}/progress`));
  }

  saveProgress(
    profileId: string,
    input: { episodeId?: string; movieId?: string; positionSeconds: number; durationSeconds: number }
  ): Promise<PlaybackProgress> {
    return firstValueFrom(
      this.http.put<PlaybackProgress>(`${this.baseUrl}/profiles/${profileId}/progress`, input)
    );
  }

  getWatchlist(profileId: string): Promise<WatchlistEntry[]> {
    return firstValueFrom(this.http.get<WatchlistEntry[]>(`${this.baseUrl}/profiles/${profileId}/watchlist`));
  }

  addToWatchlist(profileId: string, input: { seriesId?: string; movieId?: string }): Promise<WatchlistEntry> {
    return firstValueFrom(
      this.http.post<WatchlistEntry>(`${this.baseUrl}/profiles/${profileId}/watchlist`, input)
    );
  }

  removeFromWatchlist(profileId: string, entryId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.baseUrl}/profiles/${profileId}/watchlist/${entryId}`));
  }

  getFavorites(profileId: string): Promise<FavoriteEntry[]> {
    return firstValueFrom(this.http.get<FavoriteEntry[]>(`${this.baseUrl}/profiles/${profileId}/favorites`));
  }

  addFavorite(profileId: string, input: { seriesId?: string; movieId?: string }): Promise<FavoriteEntry> {
    return firstValueFrom(this.http.post<FavoriteEntry>(`${this.baseUrl}/profiles/${profileId}/favorites`, input));
  }

  removeFavorite(profileId: string, entryId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.baseUrl}/profiles/${profileId}/favorites/${entryId}`));
  }

  getHistory(profileId: string): Promise<WatchHistoryEntry[]> {
    return firstValueFrom(this.http.get<WatchHistoryEntry[]>(`${this.baseUrl}/profiles/${profileId}/history`));
  }

  getPreferences(profileId: string): Promise<ProfilePreferences> {
    return firstValueFrom(this.http.get<ProfilePreferences>(`${this.baseUrl}/profiles/${profileId}/preferences`));
  }

  updatePreferences(
    profileId: string,
    input: Partial<Omit<ProfilePreferences, 'profileId'>>
  ): Promise<ProfilePreferences> {
    return firstValueFrom(
      this.http.patch<ProfilePreferences>(`${this.baseUrl}/profiles/${profileId}/preferences`, input)
    );
  }
}
