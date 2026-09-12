// Platform-specific playback lives behind this interface. The web/webOS client uses
// Html5PlayerAdapter (plain <video>, since webOS's player IS HTML5 video). A future
// Android TV client implements the same contract on top of Media3/ExoPlayer natively.

export type PlayerTrack = {
  id: string;
  label: string;
  language?: string;
};

export type PlayerAdapterEvents = {
  timeupdate: { currentTime: number; duration: number };
  play: undefined;
  pause: undefined;
  ended: undefined;
  error: { message: string };
  waiting: undefined;
  canplay: undefined;
};

export type LoadOptions = {
  autoplay?: boolean;
  startAtSeconds?: number;
  subtitleUrl?: string | null;
};

export interface PlayerAdapter {
  load(src: string, options?: LoadOptions): Promise<void>;

  play(): Promise<void>;
  pause(): Promise<void>;

  seekTo(seconds: number): Promise<void>;
  seekBy(seconds: number): Promise<void>;

  getCurrentTime(): number;
  getDuration(): number;
  isPaused(): boolean;

  getAudioTracks(): PlayerTrack[];
  getSubtitleTracks(): PlayerTrack[];

  setSubtitleTrack(trackId: string | null): Promise<void>;
  setAudioTrack(trackId: string): Promise<void>;

  /** Swaps the active subtitle <track> without reloading the video (so playback
   * position is preserved) — for switching subtitle selection mid-playback. */
  setSubtitleUrl(url: string | null): Promise<void>;

  setPlaybackRate(rate: number): void;

  on<K extends keyof PlayerAdapterEvents>(
    event: K,
    handler: (payload: PlayerAdapterEvents[K]) => void
  ): () => void;

  destroy(): void;
}
