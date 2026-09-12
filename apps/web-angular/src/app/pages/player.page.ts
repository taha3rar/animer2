import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { Html5PlayerAdapter } from '@streaming/player';

import type { PlayerAdapter } from '@streaming/player';
import {
  parseChapters,
  resolveIntroRange,
  resolveEndingRange,
  parseStoryboard,
  findStoryboardCue,
  fetchSubtitleAsVttUrl,
} from '@streaming/player';

import type {
  Chapter,
  IntroRange,
  EndingRange,
  StoryboardCue,
} from '@streaming/player';

import type {
  Episode,
  EpisodeContext,
  Movie,
  ProfilePreferences,
  SubtitleTrack,
} from '@streaming/types';

import { ApiService } from '../core/api.service';
import { ProfileService } from '../core/profile.service';
import { toPlayableUrl } from '../core/config';

import { FocusableDirective } from '../tv/focusable.directive';
import { FocusOnSpawnDirective } from './../tv/focus-on-spawn.directive';
import { DefaultFocusDirective } from '../tv/default-focus.directive';
import { IconComponent } from '../components/icon.component';

const PROGRESS_SAVE_INTERVAL_MS = 10_000;
const CONTROLS_HIDE_DELAY_MS = 4_000;
const SEEK_STEP_SECONDS = 10;

const MAX_PLAYER_RELOAD_ATTEMPTS = 3;
const PLAYER_RELOAD_RESET_MS = 10_000;
const PLAYER_RELOAD_SKIP_SECONDS = 1;

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '0:00';
  }

  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);

  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');

  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

@Component({
  selector: 'app-player-page',
  standalone: true,
  imports: [
    FocusableDirective,
    FocusOnSpawnDirective,
    DefaultFocusDirective,
    IconComponent,
  ],
  templateUrl: './player.page.html',
  styleUrl: './player.page.scss',
})
export class PlayerPageComponent implements OnDestroy {
  private api = inject(ApiService);
  private profileService = inject(ProfileService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);

  @ViewChild('video')
  videoRef!: ElementRef<HTMLVideoElement>;

  // ---------------------------------------------------------------------------
  // Explicit control-nav anchors — see handle*KeyDown below. The hub-and-spoke
  // layout (Play button dead-center, top/bottom rows spanning full width) trips
  // up the generic geometry-based spatial nav, so Up/Down between these zones
  // is wired by hand instead of left to `findNextFocusTarget`.
  // ---------------------------------------------------------------------------

  @ViewChild('backBtnEl') private backBtnEl?: ElementRef<HTMLButtonElement>;
  @ViewChild('playBtnEl') private playBtnEl?: ElementRef<HTMLButtonElement>;
  @ViewChild('prevBtnEl') private prevBtnEl?: ElementRef<HTMLButtonElement>;
  @ViewChild('nextBtnEl') private nextBtnEl?: ElementRef<HTMLButtonElement>;
  @ViewChild('skipIntroBtnEl') private skipIntroBtnEl?: ElementRef<HTMLButtonElement>;
  @ViewChild('nextEpisodePromptBtnEl') private nextEpisodePromptBtnEl?: ElementRef<HTMLButtonElement>;

  protected Math = Math;

  formatTime = formatTime;

  isEpisode = false;

  private id = '';

  private adapter: PlayerAdapter | null = null;

  private wasPlayingBeforeSeek = false;

  private progressInterval?: ReturnType<typeof setInterval>;

  private controlsHideTimeout?: ReturnType<typeof setTimeout>;

  // ---------------------------------------------------------------------------
  // Player error recovery
  // ---------------------------------------------------------------------------

  private isReloadingPlayer = false;

  private reloadAttempts = 0;

  private reloadResetTimeout?: ReturnType<typeof setTimeout>;

  // ---------------------------------------------------------------------------

  private onVisibilityChange = () => {
    if (document.visibilityState === 'hidden' && this.adapter) {
      this.saveProgress(
        this.adapter.getCurrentTime(),
        this.adapter.getDuration(),
      );
    }
  };

  private onKeyDown = () => this.showControls();

  content = signal<Episode | Movie | undefined>(undefined);

  episodeContext = signal<EpisodeContext | undefined>(undefined);

  preferences = signal<ProfilePreferences | undefined>(undefined);
  originalSubtitles="";
  continueWatching = signal<
    {
      episodeId?: string;
      movieId?: string;
      positionSeconds: number;
    }[]
  >([]);

  loading = signal(true);

  buffering = signal(false);

  currentTime = signal(0);

  duration = signal(0);

  isPaused = signal(true);

  controlsVisible = signal(true);

  isSeeking = signal(false);

  previewTime = signal(0);

  selectedSubtitle = signal<SubtitleTrack | null>(null);

  subtitleBlobUrl = signal<string | null>(null);

  subtitlesPanelOpen = signal(false);

  private chapters = signal<Chapter[]>([]);

  private storyboardCues = signal<StoryboardCue[]>([]);

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const kind = params.get('kind') as 'episode' | 'movie';
      const id = params.get('id')!;

      this.isEpisode = kind === 'episode';
      this.id = id;

      this.loadForRoute(kind, id);
    });

    window.addEventListener('keydown', this.onKeyDown);

    document.addEventListener(
      'visibilitychange',
      this.onVisibilityChange,
    );

    this.progressInterval = setInterval(() => {
      if (this.adapter && !this.adapter.isPaused()) {
        this.saveProgress(
          this.adapter.getCurrentTime(),
          this.adapter.getDuration(),
        );
      }
    }, PROGRESS_SAVE_INTERVAL_MS);
  }

  private async loadForRoute(
    kind: 'episode' | 'movie',
    id: string,
  ): Promise<void> {
    this.loading.set(true);

    this.teardownAdapter();

    this.reloadAttempts = 0;
    this.isReloadingPlayer = false;

    const profileId = this.profileService.activeProfile()!.id;

    const isEpisode = kind === 'episode';

    const [
      content,
      episodeContext,
      preferences,
      continueWatching,
    ] = await Promise.all([
      isEpisode
        ? this.api.getEpisode(id)
        : this.api.getMovie(id),

      isEpisode
        ? this.api.getEpisodeContext(id)
        : Promise.resolve(undefined),

      this.api.getPreferences(profileId),

      this.api.getContinueWatching(profileId),
    ]);

    console.log(content);

    this.content.set(content);
    this.episodeContext.set(episodeContext);
    this.preferences.set(preferences);
    this.continueWatching.set(continueWatching);

    // Chapters (Skip Intro / next-episode-prompt) and the storyboard (seek
    // thumbnails) are both nice-to-haves, not required to start playback —
    // the storyboard file especially can be large/slow to fetch+parse, and
    // used to stall the entire episode from starting until it finished.
    // Fetch them in the background instead; the seek preview shows a blank
    // square until storyboardCues actually lands. Guarded by `this.id` so a
    // slow response from a previous episode can't clobber a newer one.
    this.chapters.set([]);
    this.storyboardCues.set([]);

    if (content.chaptersUrl) {
      fetch(toPlayableUrl(content.chaptersUrl))
        .then((r) => r.text())
        .then((text) => {
          if (this.id !== id) return;
          this.chapters.set(parseChapters(text));
        })
        .catch(() => {});
    }

    if (content.storyboardUrl) {
      const storyboardUrl = content.storyboardUrl;

      fetch(toPlayableUrl(storyboardUrl))
        .then((r) => r.text())
        .then((text) => {
          if (this.id !== id) return;
          this.storyboardCues.set(parseStoryboard(text, storyboardUrl));
        })
        .catch(() => {});
    }

    const subtitleTracks = content.subtitles ?? [];

    let initialSubtitle: SubtitleTrack | null = null;

    if (
      subtitleTracks.length &&
      preferences.subtitlesEnabled !== false
    ) {
      initialSubtitle =
        subtitleTracks.find(
          (t) =>
            t.language ===
            preferences.preferredSubtitleLanguage,
        ) ??
        subtitleTracks.find((t) => t.default) ??
        null;
    }

    this.selectedSubtitle.set(initialSubtitle);

    await this.applySubtitle(initialSubtitle);

    const match = continueWatching.find((item) =>
      isEpisode
        ? item.episodeId === id
        : item.movieId === id,
    );

    const resumeAt = match?.positionSeconds ?? 0;

    // Wait for Angular to render the <video>.
    await new Promise((resolve) =>
      setTimeout(resolve, 0),
    );

    if (!this.videoRef) {
      return;
    }

    this.loading.set(false);

    const adapter = this.createAdapter();

    this.adapter = adapter;
    console.log(this.originalSubtitles)
    await adapter.load(content.videoUrl, {
      autoplay: true,
      startAtSeconds:
        resumeAt > 5
          ? resumeAt
          : 0,
      subtitleUrl: this.originalSubtitles,
    });
    
    adapter.play();
    console.log('loaded');
  }

  // ===========================================================================
  // ADAPTER CREATION
  // ===========================================================================

  private createAdapter(): PlayerAdapter {
    const adapter = new Html5PlayerAdapter(
      this.videoRef.nativeElement,
    );

    adapter.on(
      'timeupdate',
      ({ currentTime, duration }) => {
        this.currentTime.set(currentTime);
        this.duration.set(duration);
      },
    );

    adapter.on('play', () => {
      this.isPaused.set(false);

      // If the recovered player manages to play normally for
      // 10 seconds, consider the recovery successful and reset
      // the retry counter.
      if (this.reloadResetTimeout) {
        clearTimeout(this.reloadResetTimeout);
      }

      this.reloadResetTimeout = setTimeout(() => {
        this.reloadAttempts = 0;
      }, PLAYER_RELOAD_RESET_MS);
    });

    adapter.on('pause', () => {
      this.isPaused.set(true);
    });

    adapter.on('waiting', () => {
      this.buffering.set(true);
    });

    adapter.on('canplay', () => {
      this.buffering.set(false);
    });

    adapter.on('ended', () => {
      console.log('ENDED');

      this.saveProgress(
        adapter.getDuration(),
        adapter.getDuration(),
      );

      const next =
        this.episodeContext()?.nextEpisode;

      if (
        this.isEpisode &&
        this.preferences()?.autoplayNextEpisode !== false &&
        next
      ) {
        this.router.navigateByUrl(
          `/watch/episode/${next.id}`,
          {
            replaceUrl: true,
          },
        );
      }
    });

    adapter.on('error', (err) => {
      console.error('PLAYER ERROR', err);

      // Ignore errors fired by an adapter that has already been
      // replaced.
      if (this.adapter !== adapter) {
        return;
      }

      void this.reloadPlayer();
    });

    return adapter;
  }

  // ===========================================================================
  // PLAYER RECOVERY
  // ===========================================================================

  private async reloadPlayer(): Promise<void> {
    // Prevent 5 error events from causing 5 simultaneous reloads.
    if (this.isReloadingPlayer) {
      console.warn(
        'Player recovery already in progress',
      );

      return;
    }

    if (
      this.reloadAttempts >=
      MAX_PLAYER_RELOAD_ATTEMPTS
    ) {
      console.error(
        `Player recovery failed after ${MAX_PLAYER_RELOAD_ATTEMPTS} attempts`,
      );

      this.buffering.set(false);

      return;
    }

    const content = this.content();

    if (!content || !this.videoRef) {
      return;
    }

    this.isReloadingPlayer = true;
    this.reloadAttempts++;

    const oldAdapter = this.adapter;

    // -------------------------------------------------------------------------
    // Save our current position before destroying the broken pipeline.
    // -------------------------------------------------------------------------

    let currentTime = this.currentTime();
    let duration = this.duration();

    if (oldAdapter) {
      try {
        const adapterTime =
          oldAdapter.getCurrentTime();

        if (
          Number.isFinite(adapterTime) &&
          adapterTime >= 0
        ) {
          currentTime = adapterTime;
        }
      } catch {
        // Broken adapter may no longer return a valid time.
      }

      try {
        const adapterDuration =
          oldAdapter.getDuration();

        if (
          Number.isFinite(adapterDuration) &&
          adapterDuration > 0
        ) {
          duration = adapterDuration;
        }
      } catch {
        // Ignore.
      }
    }

    // If we were playing before Chrome's pipeline died,
    // continue playing after recovery.
    //
    // isPaused() can sometimes become unreliable once a decoder
    // has fatally errored, so also use our UI state as fallback.
    let shouldAutoplay = !this.isPaused();

    if (oldAdapter) {
      try {
        shouldAutoplay =
          !oldAdapter.isPaused();
      } catch {
        // Keep signal-derived value.
      }
    }

    // Move 1 second past the location where the demuxer died.
    let resumeAt =
      currentTime +
      PLAYER_RELOAD_SKIP_SECONDS;

    if (
      Number.isFinite(duration) &&
      duration > 0
    ) {
      resumeAt = Math.min(
        resumeAt,
        Math.max(
          0,
          duration - 0.25,
        ),
      );
    }

    resumeAt = Math.max(
      0,
      resumeAt,
    );

    console.warn(
      `Reloading player at ${resumeAt.toFixed(2)}s ` +
        `(attempt ${this.reloadAttempts}/${MAX_PLAYER_RELOAD_ATTEMPTS})`,
    );

    this.buffering.set(true);

    try {
      // -----------------------------------------------------------------------
      // Completely destroy the old adapter.
      // -----------------------------------------------------------------------

      if (oldAdapter) {
        try {
          oldAdapter.destroy();
        } catch (error) {
          console.warn(
            'Error destroying old adapter:',
            error,
          );
        }
      }

      if (this.adapter === oldAdapter) {
        this.adapter = null;
      }

      // -----------------------------------------------------------------------
      // Force Chrome to throw away its broken media pipeline.
      // -----------------------------------------------------------------------

      const video =
        this.videoRef.nativeElement;

      try {
        video.pause();
      } catch {
        // Ignore.
      }

      video.removeAttribute('src');

      video.load();

      // Let the browser finish destroying the previous decoder /
      // demuxer before attaching another adapter.
      await new Promise<void>(
        (resolve) => {
          requestAnimationFrame(() => {
            resolve();
          });
        },
      );

      // -----------------------------------------------------------------------
      // Create a completely fresh adapter.
      // -----------------------------------------------------------------------

      const adapter =
        this.createAdapter();

      this.adapter = adapter;

      await adapter.load(
        content.videoUrl,
        {
          autoplay:
            shouldAutoplay,
          startAtSeconds:
            resumeAt,
          subtitleUrl:
            this.subtitleBlobUrl(),
        },
      );

      console.log(
        `Player recovered successfully at ${resumeAt.toFixed(2)}s`,
      );
      this.reloadAttempts=0;
    } catch (error) {
      console.error(
        'Player recovery failed:',
        error,
      );

      // If load() itself fails but doesn't emit the adapter's
      // normal error event, schedule another recovery ourselves.
      this.isReloadingPlayer = false;

      if (
        this.reloadAttempts <
        MAX_PLAYER_RELOAD_ATTEMPTS
      ) {
        await this.reloadPlayer();
        return;
      }
    } finally {
      this.buffering.set(false);
      this.isReloadingPlayer = false;
    }
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  private teardownAdapter(): void {
    if (this.reloadResetTimeout) {
      clearTimeout(
        this.reloadResetTimeout,
      );

      this.reloadResetTimeout =
        undefined;
    }

    if (this.adapter) {
      try {
        this.saveProgress(
          this.adapter.getCurrentTime(),
          this.adapter.getDuration(),
        );
      } catch {
        // Adapter may already be in a broken state.
      }

      try {
        this.adapter.destroy();
      } catch {
        // Ignore teardown failures.
      }

      this.adapter = null;
    }

    this.currentTime.set(0);
    this.duration.set(0);
    this.isPaused.set(true);
    this.buffering.set(false);
  }

  ngOnDestroy(): void {
    this.teardownAdapter();

    if (this.progressInterval) {
      clearInterval(
        this.progressInterval,
      );
    }

    if (this.controlsHideTimeout) {
      clearTimeout(
        this.controlsHideTimeout,
      );
    }

    if (this.reloadResetTimeout) {
      clearTimeout(
        this.reloadResetTimeout,
      );
    }

    window.removeEventListener(
      'keydown',
      this.onKeyDown,
    );

    document.removeEventListener(
      'visibilitychange',
      this.onVisibilityChange,
    );

    const url =
      this.subtitleBlobUrl();

    if (url) {
      URL.revokeObjectURL(url);
    }
  }

  // ===========================================================================
  // PROGRESS
  // ===========================================================================

  private saveProgress(
    position: number,
    total: number,
  ): void {
    if (
      !this.id ||
      total <= 0
    ) {
      return;
    }

    this.api
      .saveProgress(
        this.profileService.activeProfile()!.id,
        {
          episodeId:
            this.isEpisode
              ? this.id
              : undefined,

          movieId:
            this.isEpisode
              ? undefined
              : this.id,

          positionSeconds:
            Math.floor(position),

          durationSeconds:
            Math.floor(total),
        },
      )
      .catch(() => {
        // best-effort: a dropped progress tick
        // isn't worth surfacing to the viewer
      });
  }

  // ===========================================================================
  // DISPLAY
  // ===========================================================================

  title(): string {
    return (
      this.content()?.title ??
      ''
    );
  }

  subtitleLabel():
    | string
    | undefined {
    const content =
      this.content();

    return (
      this.isEpisode &&
      content &&
      'episodeNumber' in content
    )
      ? `Episode ${content.episodeNumber}`
      : undefined;
  }

  displayTime(): number {
    return this.isSeeking()
      ? this.previewTime()
      : this.currentTime();
  }

  progressPercent(): number {
    const d = this.duration();

    return d > 0
      ? (this.displayTime() / d) *
          100
      : 0;
  }

  subtitleTracks(): SubtitleTrack[] {
    return (
      this.content()?.subtitles ??
      []
    );
  }

  // ===========================================================================
  // INTRO / CHAPTERS
  // ===========================================================================

  private introRange():
    | IntroRange
    | null {
    return resolveIntroRange(
      this.chapters(),
      this.content(),
    );
  }

  showSkipIntro(): boolean {
    // Chapters can resolve before the adapter has actually started playback,
    // so without this the button would flash in over the loading spinner —
    // currentTime() is still 0 at that point, which sits inside every intro
    // range by definition.
    if (this.loading()) {
      return false;
    }

    const range =
      this.introRange();

    const t =
      this.currentTime();

    return (
      !!range &&
      t >= range.start &&
      t < range.end
    );
  }

  private endingRange():
    | EndingRange
    | null {
    return resolveEndingRange(
      this.chapters(),
    );
  }

  showNextEpisodePrompt(): boolean {
    if (this.loading()) {
      return false;
    }

    const range =
      this.endingRange();

    if (!range) {
      return false;
    }

    return (
      this.currentTime() >= range.start &&
      !!this.episodeContext()?.nextEpisode
    );
  }

  previewStoryboardCue():
    | StoryboardCue
    | undefined {
    return this.isSeeking()
      ? findStoryboardCue(
          this.storyboardCues(),
          this.previewTime(),
        )
      : undefined;
  }

  // ===========================================================================
  // CONTROLS
  // ===========================================================================

  showControls(): void {
    this.controlsVisible.set(
      true,
    );

    if (
      this.controlsHideTimeout
    ) {
      clearTimeout(
        this.controlsHideTimeout,
      );
    }

    if (!this.isSeeking()) {
      this.controlsHideTimeout =
        setTimeout(
          () =>
            this.controlsVisible.set(
              false,
            ),
          CONTROLS_HIDE_DELAY_MS,
        );
    }
  }

  goBack(): void {
    this.location.back();
  }

  /** Last-resort escape hatch for a stuck/broken player — a full page reload,
   * distinct from the in-place `reloadPlayer()` recovery above. */
  refreshPlayer(): void {
    window.location.reload();
  }

  togglePlayPause(): void {
    const adapter =
      this.adapter;

    if (!adapter) {
      return;
    }

    if (adapter.isPaused()) {
      adapter.play();
    } else {
      adapter.pause();
    }

    this.showControls();
  }

  seekToClick(
    e: MouseEvent,
  ): void {
    const bar =
      e.currentTarget as HTMLElement;

    const rect =
      bar.getBoundingClientRect();

    const fraction =
      Math.min(
        Math.max(
          (e.clientX -
            rect.left) /
            rect.width,
          0,
        ),
        1,
      );

    const d =
      this.duration();

    if (d > 0) {
      this.adapter?.seekTo(
        fraction * d,
      );
    }

    this.showControls();
  }

  goToNeighborEpisode(
    episodeId:
      | string
      | undefined,
  ): void {
    if (!episodeId) {
      return;
    }

    this.router.navigateByUrl(
      `/watch/episode/${episodeId}`,
      {
        replaceUrl: true,
      },
    );
  }

  skipIntro(): void {
    const range =
      this.introRange();

    if (!range) {
      return;
    }

    this.adapter?.seekTo(
      range.end,
    );

    this.showControls();
  }

  // ===========================================================================
  // SEEK PREVIEW
  // ===========================================================================

  private enterSeekMode(): void {
    const adapter =
      this.adapter;

    if (
      !adapter ||
      this.isSeeking()
    ) {
      return;
    }

    this.wasPlayingBeforeSeek =
      !adapter.isPaused();

    adapter.pause();

    this.previewTime.set(
      this.currentTime(),
    );

    this.isSeeking.set(true);
  }

  private movePreview(
    deltaSeconds: number,
  ): void {
    const d =
      this.duration();

    this.previewTime.update(
      (t) =>
        Math.min(
          Math.max(
            t + deltaSeconds,
            0,
          ),
          d > 0
            ? d
            : t +
                deltaSeconds,
        ),
    );
  }

  private confirmSeek(): void {
    this.adapter?.seekTo(
      this.previewTime(),
    );

    if (
      this.wasPlayingBeforeSeek
    ) {
      this.adapter?.play();
    }

    this.isSeeking.set(false);
  }

  private cancelSeek(): void {
    this.previewTime.set(
      this.currentTime(),
    );

    if (
      this.wasPlayingBeforeSeek
    ) {
      this.adapter?.play();
    }

    this.isSeeking.set(false);
  }

  activatePlayButton(): void {
    if (this.isSeeking()) {
      this.confirmSeek();
    } else {
      this.togglePlayPause();
    }
  }

  handlePlayButtonKeyDown(
    e: KeyboardEvent,
  ): void {
    if (
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight'
    ) {
      e.preventDefault();
      e.stopPropagation();

      if (!this.isSeeking()) {
        this.enterSeekMode();
      }

      this.movePreview(
        e.key === 'ArrowLeft'
          ? -SEEK_STEP_SECONDS
          : SEEK_STEP_SECONDS,
      );

      return;
    }

    if (
      e.key === 'Enter' ||
      e.key === ' '
    ) {
      e.preventDefault();
      e.stopPropagation();

      this.activatePlayButton();

      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();

      if (this.isSeeking()) {
        this.cancelSeek();
      } else {
        this.backBtnEl?.nativeElement.focus();
      }

      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();

      if (this.isSeeking()) {
        this.cancelSeek();
      } else if (this.showSkipIntro()) {
        this.skipIntroBtnEl?.nativeElement.focus();
      } else if (this.showNextEpisodePrompt()) {
        this.nextEpisodePromptBtnEl?.nativeElement.focus();
      } else if (this.nextBtnEl) {
        this.nextBtnEl.nativeElement.focus();
      } else {
        this.prevBtnEl?.nativeElement.focus();
      }
    }
  }

  // ===========================================================================
  // TOP BAR / BOTTOM ROW / SKIP INTRO NAV
  // ===========================================================================

  handleTopBarKeyDown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      this.playBtnEl?.nativeElement.focus();
    }
  }

  handleNavRowKeyDown(e: KeyboardEvent, which: 'previous' | 'next'): void {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();

      if (this.showSkipIntro()) {
        this.skipIntroBtnEl?.nativeElement.focus();
      } else if (this.showNextEpisodePrompt()) {
        this.nextEpisodePromptBtnEl?.nativeElement.focus();
      } else {
        this.playBtnEl?.nativeElement.focus();
      }

      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      if (which === 'next') this.prevBtnEl?.nativeElement.focus();
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      if (which === 'previous') this.nextBtnEl?.nativeElement.focus();
    }
  }

  handleSkipIntroKeyDown(e: KeyboardEvent): void {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      this.playBtnEl?.nativeElement.focus();
    }
  }

  handleNextEpisodePromptKeyDown(e: KeyboardEvent): void {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      this.playBtnEl?.nativeElement.focus();
    }
  }

  // ===========================================================================
  // SUBTITLES
  // ===========================================================================

  private async applySubtitle(
    track: SubtitleTrack | null,
  ): Promise<void> {
    const previous =
      this.subtitleBlobUrl();

    if (previous) {
      URL.revokeObjectURL(
        previous,
      );
    }

    if (!track) {
      this.subtitleBlobUrl.set(
        null,
      );

      return;
    }

    const url =
      await fetchSubtitleAsVttUrl({
        ...track,
        url: toPlayableUrl(
          track.url,
        ),
      });
      this.originalSubtitles=url
    this.subtitleBlobUrl.set(
      url,
    );

    await this.adapter?.setSubtitleUrl(
      url,
    );
  }

  selectSubtitle(
    track: SubtitleTrack | null,
  ): void {
    this.selectedSubtitle.set(
      track,
    );

    this.subtitlesPanelOpen.set(
      false,
    );

    this.applySubtitle(track);

    this.api
      .updatePreferences(
        this.profileService.activeProfile()!.id,
        {
          subtitlesEnabled:
            track != null,

          ...(track
            ? {
                preferredSubtitleLanguage:
                  track.language,
              }
            : {}),
        },
      )
      .catch(() => {
        // best-effort: subtitle choice still
        // applies this session even if save fails
      });
  }
}