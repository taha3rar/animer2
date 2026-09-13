import type {
  LoadOptions,
  PlayerAdapter,
  PlayerAdapterEvents,
  PlayerTrack,
} from "./PlayerAdapter";

type Handler<K extends keyof PlayerAdapterEvents> = (
  payload: PlayerAdapterEvents[K]
) => void;

/**
 * Wraps a plain HTMLVideoElement. Used by the browser dev build and by the
 * webOS client, since webOS's native video playback is exposed through a
 * standard HTML5 <video> element. The active source (AnimeHeaven) only ever
 * serves plain progressive MP4 with range-request support — native
 * `<video src>` handles that natively with no extra machinery, so there's no
 * HLS/hls.js path here (that only mattered for the AniZone source, which
 * this app no longer uses for playback).
 */
export class Html5PlayerAdapter implements PlayerAdapter {
  private video: HTMLVideoElement;
  private trackEl: HTMLTrackElement | null = null;
  private listeners = new Map<keyof PlayerAdapterEvents, Set<Handler<any>>>();
  private domCleanup: Array<() => void> = [];
  private textTracksChangeCleanup: (() => void) | null = null;

  constructor(video: HTMLVideoElement) {
    this.video = video;
    this.bindDomEvents();
  }

  private bindDomEvents() {
    const bind = (domEvent: string, emit: () => void) => {
      const listener = () => emit();
      this.video.addEventListener(domEvent, listener);
      this.domCleanup.push(() => this.video.removeEventListener(domEvent, listener));
    };

    bind("timeupdate", () =>
      this.emit("timeupdate", {
        currentTime: this.video.currentTime,
        duration: this.video.duration || 0,
      })
    );
    bind("play", () => this.emit("play", undefined));
    bind("pause", () => this.emit("pause", undefined));
    bind("ended", () => this.emit("ended", undefined));
    bind("waiting", () => this.emit("waiting", undefined));
    bind("canplay", () => this.emit("canplay", undefined));
    bind("error", () =>
      this.emit("error", {
        message: `${this.video.error?.message ?? "Unknown playback error"} (code ${this.video.error?.code ?? "?"})`,
      })
    );
  }

  async load(src: string, options: LoadOptions = {}): Promise<void> {
    this.video.src = src;
    this.video.autoplay = options.autoplay ?? false;
    await this.setSubtitleUrl(options.subtitleUrl ?? null);
    this.video.load();

    if (options.startAtSeconds && options.startAtSeconds > 0) {
      await new Promise<void>((resolve) => {
        const onLoaded = () => {
          this.video.currentTime = options.startAtSeconds!;
          this.video.removeEventListener("loadedmetadata", onLoaded);
          resolve();
        };
        this.video.addEventListener("loadedmetadata", onLoaded);
      });
    }

    if (options.autoplay) {
      try {
        await this.play();
      } catch {
        // Autoplay-with-sound is blocked by the browser unless muted or tied
        // to a direct user gesture in the same call stack — expected, not a
        // real error. The viewer just needs to press Play once.
      }
    }
  }

  async play(): Promise<void> {
    await this.video.play();
  }

  async pause(): Promise<void> {
    this.video.pause();
  }

  async seekTo(seconds: number): Promise<void> {
    this.video.currentTime = Math.max(0, seconds);
  }

  async seekBy(seconds: number): Promise<void> {
    await this.seekTo(this.video.currentTime + seconds);
  }

  getCurrentTime(): number {
    return this.video.currentTime;
  }

  getDuration(): number {
    return this.video.duration || 0;
  }

  isPaused(): boolean {
    return this.video.paused;
  }

  getAudioTracks(): PlayerTrack[] {
    const anyVideo = this.video as any;
    if (!anyVideo.audioTracks) return [];
    const tracks: PlayerTrack[] = [];
    for (let i = 0; i < anyVideo.audioTracks.length; i++) {
      const t = anyVideo.audioTracks[i];
      tracks.push({ id: t.id ?? String(i), label: t.label || `Audio ${i + 1}`, language: t.language });
    }
    return tracks;
  }

  getSubtitleTracks(): PlayerTrack[] {
    const tracks: PlayerTrack[] = [];
    for (let i = 0; i < this.video.textTracks.length; i++) {
      const t = this.video.textTracks[i];
      tracks.push({ id: String(i), label: t.label || `Subtitle ${i + 1}`, language: t.language });
    }
    return tracks;
  }

  async setSubtitleTrack(trackId: string | null): Promise<void> {
    for (let i = 0; i < this.video.textTracks.length; i++) {
      this.video.textTracks[i].mode = String(i) === trackId ? "showing" : "disabled";
    }
  }

  async setSubtitleUrl(url: string | null): Promise<void> {
    if (this.trackEl) {
      this.trackEl.remove();
      this.trackEl = null;
    }
    if (this.textTracksChangeCleanup) {
      this.textTracksChangeCleanup();
      this.textTracksChangeCleanup = null;
    }
    if (!url) return;

    const track = document.createElement("track");
    track.kind = "subtitles";
    track.src = url;
    track.default = true;

    const forceShowing = () => {
      if (track.track && track.track.mode !== "showing") {
        track.track.mode = "showing";
      }
    };

    // Dynamically-added tracks don't reliably honor `default` in every
    // browser — a persistent "change" listener re-asserts "showing" against
    // whichever track wins the browser's own selection race, instead of
    // trusting a single one-shot "load" event to land at the right time.
    track.addEventListener("load", forceShowing);
    this.video.textTracks.addEventListener("change", forceShowing);
    this.textTracksChangeCleanup = () => this.video.textTracks.removeEventListener("change", forceShowing);

    this.video.appendChild(track);
    this.trackEl = track;
    forceShowing();
  }

  async setAudioTrack(trackId: string): Promise<void> {
    const anyVideo = this.video as any;
    if (!anyVideo.audioTracks) return;
    for (let i = 0; i < anyVideo.audioTracks.length; i++) {
      anyVideo.audioTracks[i].enabled = (anyVideo.audioTracks[i].id ?? String(i)) === trackId;
    }
  }

  setPlaybackRate(rate: number): void {
    this.video.playbackRate = rate;
  }

  on<K extends keyof PlayerAdapterEvents>(event: K, handler: Handler<K>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  private emit<K extends keyof PlayerAdapterEvents>(event: K, payload: PlayerAdapterEvents[K]) {
    this.listeners.get(event)?.forEach((handler) => handler(payload));
  }

  destroy(): void {
    this.domCleanup.forEach((fn) => fn());
    this.domCleanup = [];
    this.listeners.clear();

    // Without this, a fresh adapter recreated on the same <video> (e.g. the
    // player's error-recovery reload) starts from a null trackEl of its own
    // and has no idea this element's leftovers are still attached — each
    // reload would leave one more <track> stacked on top of the last,
    // rendering duplicate/overlapping subtitles.
    this.trackEl?.remove();
    this.trackEl = null;

    this.textTracksChangeCleanup?.();
    this.textTracksChangeCleanup = null;
  }
}
