import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type { AnizoneSearchItem, ContinueWatchingItem, FavoriteEntry, Movie, Series } from '@streaming/types';
import type { AnizoneSearchResult } from '@streaming/types';
import { ApiService } from '../core/api.service';
import { ProfileService } from '../core/profile.service';
import { FocusableDirective } from '../tv/focusable.directive';
import { DefaultFocusDirective } from '../tv/default-focus.directive';
import { RowComponent } from '../components/row.component';
import { ContentCardComponent } from '../components/content-card.component';
import { AnizoneResultCardComponent } from '../components/anizone-result-card.component';
import { AnizonePreviewModalComponent } from '../components/anizone-preview-modal.component';
import { SkeletonRowComponent } from '../components/skeleton-row.component';
import { IconComponent } from '../components/icon.component';

type HeroItem = {
  title: string;
  meta: string;
  description?: string | null;
  backdropUrl?: string | null;
  primaryLabel: string;
  primaryUrl?: string;
  previewSeries?: Series;
};

type PreviewState = { series?: Series; searchItem?: AnizoneSearchItem };

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    FormsModule,
    FocusableDirective,
    DefaultFocusDirective,
    RowComponent,
    ContentCardComponent,
    AnizoneResultCardComponent,
    AnizonePreviewModalComponent,
    SkeletonRowComponent,
    IconComponent,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePageComponent {
  private api = inject(ApiService);
  private profileService = inject(ProfileService);
  private router = inject(Router);

  protected Math = Math;
  activeProfile = this.profileService.activeProfile;

  searchInput = '';
  submittedQuery = signal('');
  importingSlug = signal<string | null>(null);
  preview = signal<PreviewState | null>(null);

  continueWatching = signal<ContinueWatchingItem[]>([]);
  series = signal<Series[]>([]);
  movies = signal<Movie[]>([]);
  favorites = signal<FavoriteEntry[]>([]);
  searchResults = signal<AnizoneSearchResult | undefined>(undefined);
  searching = signal(false);
  searchError = signal(false);
  initialLoading = signal(true);

  constructor() {
    const profileId = this.activeProfile()!.id;
    Promise.all([
      this.api.getContinueWatching(profileId).then((v) => this.continueWatching.set(v)),
      this.api.getSeriesList().then((v) => this.series.set(v)),
      this.api.getMovies().then((v) => this.movies.set(v)),
      this.api.getFavorites(profileId).then((v) => this.favorites.set(v)),
    ]).finally(() => this.initialLoading.set(false));
  }

  heroItem(): HeroItem | null {
    const cw = this.continueWatching()[0];
    if (cw) {
      return {
        title: cw.kind === 'episode' ? cw.seriesTitle ?? cw.title : cw.title,
        meta:
          cw.kind === 'episode' && cw.seasonNumber != null
            ? `Continue Watching · S${cw.seasonNumber} E${cw.episodeNumber}`
            : 'Continue Watching',
        backdropUrl: cw.backdropUrl ?? cw.posterUrl,
        primaryLabel: 'Resume',
        primaryUrl: `/watch/${cw.kind}/${cw.episodeId ?? cw.movieId}`,
      };
    }
    const s = this.series()[0];
    if (s) {
      return {
        title: s.title,
        meta: 'Series' + (s.releaseYear ? ` · ${s.releaseYear}` : ''),
        description: s.description,
        backdropUrl: s.backdropUrl ?? s.posterUrl,
        primaryLabel: 'View',
        previewSeries: s,
      };
    }
    const m = this.movies()[0];
    if (m) {
      return {
        title: m.title,
        meta: 'Movie' + (m.releaseYear ? ` · ${m.releaseYear}` : ''),
        description: m.description,
        backdropUrl: m.backdropUrl ?? m.posterUrl,
        primaryLabel: 'Play',
        primaryUrl: `/watch/movie/${m.id}`,
      };
    }
    return null;
  }

  activateHero(hero: HeroItem): void {
    if (hero.previewSeries) {
      this.openSeriesPreview(hero.previewSeries);
    } else if (hero.primaryUrl) {
      this.navigate(hero.primaryUrl);
    }
  }

  navigate(url: string): void {
    this.router.navigateByUrl(url);
  }

  switchProfile(): void {
    this.profileService.clearActiveProfile();
    this.router.navigateByUrl('/profiles');
  }

  isInLibrary(item: AnizoneSearchItem): boolean {
    return this.series().some((s) => s.sourceSlug === item.slug);
  }

  matchedSeriesFor(item: AnizoneSearchItem): Series | undefined {
    return this.series().find((s) => s.sourceSlug === item.slug);
  }

  favoriteEntryFor(series: Series): FavoriteEntry | undefined {
    return this.favorites().find((f) => f.seriesId === series.id);
  }

  openSeriesPreview(series: Series): void {
    this.preview.set({ series });
  }

  openSearchPreview(item: AnizoneSearchItem): void {
    this.preview.set({ searchItem: item, series: this.matchedSeriesFor(item) });
  }

  trackCw(item: ContinueWatchingItem): string {
    return item.episodeId ?? item.movieId ?? item.title;
  }

  async handleSearchSubmit(e: Event): Promise<void> {
    e.preventDefault();
    const query = this.searchInput.trim();
    this.submittedQuery.set(query);
    if (!query) return;
    this.searching.set(true);
    this.searchError.set(false);
    try {
      const results = await this.api.searchAnizone(query);
      this.searchResults.set(results);
    } catch {
      this.searchError.set(true);
      this.searchResults.set(undefined);
    } finally {
      this.searching.set(false);
    }
  }

  async handleImport(item: AnizoneSearchItem): Promise<void> {
    this.importingSlug.set(item.slug);
    try {
      const imported = await this.api.importAnizoneSeries({
        slug: item.slug,
        title: item.title,
        sourceUrl: item.sourceUrl,
        coverUrl: item.coverUrl ?? undefined,
        startYear: item.startYear ?? undefined,
      });
      const refreshed = await this.api.getSeriesList();
      this.series.set(refreshed);
      // Flip the still-open modal straight into its "in library" state
      // (full episode list, Play/Favorite) instead of requiring a re-open.
      this.preview.set({ searchItem: item, series: refreshed.find((s) => s.id === imported.id) ?? imported });
    } catch {
      // best-effort — the modal just stays on "+ Add to Library" so the user can retry
    } finally {
      this.importingSlug.set(null);
    }
  }

  async toggleFavorite(series: Series): Promise<void> {
    const profileId = this.activeProfile()!.id;
    const entry = this.favoriteEntryFor(series);
    if (entry) {
      await this.api.removeFavorite(profileId, entry.id);
    } else {
      await this.api.addFavorite(profileId, { seriesId: series.id });
    }
    const refreshed = await this.api.getFavorites(profileId);
    this.favorites.set(refreshed);
  }
}
