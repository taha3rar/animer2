import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { AnizoneEpisode, AnizoneSearchItem, ContinueWatchingItem, Series } from '@streaming/types';
import { ApiService, type SeriesDetail } from '../core/api.service';
import { FocusableDirective } from '../tv/focusable.directive';
import { focusFirstAvailable } from '../tv/spatial-navigation';

// Same "GoBack" (LG remote) / Backspace / Escape (dev keyboard) set the global
// TV nav treats as Back — here it closes the modal instead of navigating away.
const BACK_KEYS = new Set(['GoBack', 'Backspace', 'Escape']);

type EpisodeRow = {
  episodeNumber: number;
  title: string;
  localId?: string;
  thumbnailUrl?: string | null;
  durationSeconds?: number;
  progress?: number;
  isCurrent: boolean;
  resolving: boolean;
};

/**
 * The one "tell me about this show" surface, used from every entry point:
 * an AniZone search result (maybe not in the library yet), a library Series
 * card, or a Favorites entry. Pass `series` when it's already in the library
 * (drives the full episode list + favorite toggle) and/or `searchItem` when
 * it came from an AniZone search (drives the "Add to Library" flow when not
 * matched to a series yet). At least one must be set.
 *
 * The episode list is built from AniZone's full per-series episode metadata
 * (all N episodes, e.g. 220 for Naruto) rather than only the handful that
 * happen to already be resolved into local Episode records — resolution
 * happens lazily per-episode (server does a find-or-scrape) the moment you
 * click a row that isn't resolved yet, same as the existing "Watch Now" flow.
 */
@Component({
  selector: 'app-anizone-preview-modal',
  standalone: true,
  imports: [FocusableDirective],
  templateUrl: './anizone-preview-modal.component.html',
  styleUrl: './anizone-preview-modal.component.scss',
})
export class AnizonePreviewModalComponent implements OnChanges {
  @Input() series?: Series;
  @Input() searchItem?: AnizoneSearchItem;
  @Input() isFavorite = false;
  @Input() continueWatching: ContinueWatchingItem[] | undefined;
  @Input() isImporting = false;
  @Output() importClick = new EventEmitter<void>();
  @Output() closeClick = new EventEmitter<void>();
  @Output() toggleFavorite = new EventEmitter<void>();

  private api = inject(ApiService);
  private router = inject(Router);

  anizoneEpisodes = signal<AnizoneEpisode[]>([]);
  loadingEpisodeCount = signal(false);
  seriesDetail = signal<SeriesDetail | undefined>(undefined);
  isResolvingPrimary = signal(false);
  private resolvingEpisodeNumbers = signal<Set<number>>(new Set());
  // Set once we silently import a not-yet-library'd searchItem so a series
  // watched via multiple episode clicks doesn't re-import every time.
  private ensuredSeriesId = signal<string | undefined>(undefined);

  private slug(): string | undefined {
    return this.series?.sourceSlug ?? this.searchItem?.slug;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['series'] || changes['searchItem']) {
      const slug = this.slug();
      if (slug) {
        this.loadingEpisodeCount.set(true);
        this.api
          .getAnizoneEpisodes(slug)
          .then((eps) => this.anizoneEpisodes.set(eps))
          .catch(() => this.anizoneEpisodes.set([]))
          .finally(() => this.loadingEpisodeCount.set(false));
      } else {
        this.anizoneEpisodes.set([]);
      }

      if (this.series) {
        this.api.getSeriesDetail(this.series.id).then((detail) => this.seriesDetail.set(detail));
      } else {
        this.seriesDetail.set(undefined);
      }
      this.ensuredSeriesId.set(undefined);
    }
    requestAnimationFrame(() => focusFirstAvailable());
  }

  // Not-in-library items can still be watched straight away: this silently
  // (idempotently — the backend find-or-creates by sourceSlug) creates the
  // Series row an Episode needs to hang off of, without requiring the user
  // to press "Add to Library" first.
  private async ensureSeriesId(): Promise<string | undefined> {
    if (this.series) return this.series.id;
    const cached = this.ensuredSeriesId();
    if (cached) return cached;
    if (!this.searchItem) return undefined;
    const imported = await this.api.importAnizoneSeries({
      slug: this.searchItem.slug,
      title: this.searchItem.title,
      sourceUrl: this.searchItem.sourceUrl,
      coverUrl: this.searchItem.coverUrl ?? undefined,
      startYear: this.searchItem.startYear ?? undefined,
    });
    this.ensuredSeriesId.set(imported.id);
    return imported.id;
  }

  displayTitle(): string {
    return this.series?.title ?? this.searchItem?.title ?? '';
  }

  coverUrl(): string | null | undefined {
    return this.searchItem?.coverUrl ?? this.series?.backdropUrl ?? this.series?.posterUrl;
  }

  description(): string | null | undefined {
    return this.series?.description;
  }

  meta(): string {
    if (this.searchItem) {
      return [this.searchItem.type, this.searchItem.startYear].filter(Boolean).join(' · ');
    }
    return ['Series', this.series?.releaseYear].filter(Boolean).join(' · ');
  }

  tagNames(): string {
    return this.searchItem?.tags.map((t) => t.name).join(', ') ?? '';
  }

  episodeCount(): number | undefined {
    return this.anizoneEpisodes().length || undefined;
  }

  formatDuration(seconds: number): string {
    const m = Math.round(seconds / 60);
    return m > 0 ? `${m} min` : '';
  }

  currentProgress(): ContinueWatchingItem | null {
    const detail = this.seriesDetail();
    if (!detail) return null;
    const episodeIds = new Set(detail.seasons.flatMap((season) => season.episodes.map((ep) => ep.id)));
    return this.continueWatching?.find((cw) => cw.episodeId && episodeIds.has(cw.episodeId)) ?? null;
  }

  episodeRows(): EpisodeRow[] {
    const localByNumber = new Map<number, { id: string; thumbnailUrl?: string | null; durationSeconds: number }>();
    for (const season of this.seriesDetail()?.seasons ?? []) {
      for (const ep of season.episodes) {
        localByNumber.set(ep.episodeNumber, { id: ep.id, thumbnailUrl: ep.thumbnailUrl, durationSeconds: ep.durationSeconds });
      }
    }
    const currentEpisodeId = this.currentProgress()?.episodeId;
    const resolving = this.resolvingEpisodeNumbers();

    return this.anizoneEpisodes().map((ep) => {
      const local = localByNumber.get(ep.episodeNumber);
      const progressMatch = local
        ? this.continueWatching?.find((cw) => cw.episodeId === local.id)
        : undefined;
      return {
        episodeNumber: ep.episodeNumber,
        title: ep.title,
        localId: local?.id,
        thumbnailUrl: local?.thumbnailUrl,
        durationSeconds: local?.durationSeconds,
        progress: progressMatch ? progressMatch.positionSeconds / Math.max(progressMatch.durationSeconds, 1) : undefined,
        isCurrent: local?.id === currentEpisodeId,
        resolving: resolving.has(ep.episodeNumber),
      };
    });
  }

  handleKeyDown(e: KeyboardEvent): void {
    if (BACK_KEYS.has(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      this.closeClick.emit();
    }
  }

  private goToEpisodeId(episodeId: string): void {
    this.closeClick.emit();
    this.router.navigateByUrl(`/watch/episode/${episodeId}`);
  }

  async playEpisode(ep: EpisodeRow): Promise<void> {
    if (ep.resolving) return;
    if (ep.localId) {
      this.goToEpisodeId(ep.localId);
      return;
    }
    this.resolvingEpisodeNumbers.update((set) => new Set(set).add(ep.episodeNumber));
    try {
      const seriesId = await this.ensureSeriesId();
      if (!seriesId) return;
      const episode = await this.api.resolveAnizoneEpisode(seriesId, ep.episodeNumber);
      this.goToEpisodeId(episode.id);
    } catch {
      // best-effort — the row just stays available so the user can retry
    } finally {
      this.resolvingEpisodeNumbers.update((set) => {
        const next = new Set(set);
        next.delete(ep.episodeNumber);
        return next;
      });
    }
  }

  async playPrimary(): Promise<void> {
    const knownEpisodeId = this.currentProgress()?.episodeId ?? this.seriesDetail()?.seasons[0]?.episodes[0]?.id;
    if (knownEpisodeId) {
      this.goToEpisodeId(knownEpisodeId);
      return;
    }
    this.isResolvingPrimary.set(true);
    try {
      const seriesId = await this.ensureSeriesId();
      if (!seriesId) return;
      const episode = await this.api.resolveAnizoneEpisode(seriesId, 1);
      this.goToEpisodeId(episode.id);
    } catch {
      // best-effort — the button just stays available so the user can retry
    } finally {
      this.isResolvingPrimary.set(false);
    }
  }
}
