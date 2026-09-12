// Shared types between the API and every client (web/webOS, future Android TV).
// Keep this dependency-free — plain data shapes only.

export type Profile = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isKidsProfile: boolean;
};

export type ProfilePreferences = {
  profileId: string;
  preferredAudioLanguage?: string | null;
  preferredSubtitleLanguage?: string | null;
  subtitlesEnabled: boolean;
  autoplayNextEpisode: boolean;
  skipSecondsForward: number;
  skipSecondsBackward: number;
  defaultPlaybackSpeed: number;
};

export type Series = {
  id: string;
  title: string;
  description?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  releaseYear?: number | null;
  sourceSlug?: string | null;
  sourceUrl?: string | null;
};

export type Season = {
  id: string;
  seriesId: string;
  seasonNumber: number;
  title?: string | null;
  posterUrl?: string | null;
};

// A subtitle track as delivered by the source (currently SRT files behind a
// CDN). `title` distinguishes variants sharing a language, e.g. "English" vs
// "Only Song & Signs" — both `language: "en"`.
export type SubtitleTrack = {
  title: string;
  language: string;
  format: "srt" | "vtt" | "ass";
  url: string;
  default?: boolean;
  forced?: boolean;
};

export type Episode = {
  id: string;
  seasonId: string;
  episodeNumber: number;
  title: string;
  description?: string | null;
  durationSeconds: number;
  thumbnailUrl?: string | null;
  videoUrl: string;
  // Chapter markers (Skip Intro) and the seek-preview filmstrip — both optional
  // WebVTT sidecar files from the source. See packages/player's chapters/storyboard
  // parsers, which turn these into a generic playerState the UI renders.
  chaptersUrl?: string | null;
  storyboardUrl?: string | null;
  subtitles?: SubtitleTrack[];
  introStartSeconds?: number | null;
  introEndSeconds?: number | null;
  creditsStartSeconds?: number | null;
};

export type Movie = {
  id: string;
  title: string;
  description?: string | null;
  durationSeconds: number;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  releaseYear?: number | null;
  videoUrl: string;
  chaptersUrl?: string | null;
  storyboardUrl?: string | null;
  subtitles?: SubtitleTrack[];
  introStartSeconds?: number | null;
  introEndSeconds?: number | null;
  creditsStartSeconds?: number | null;
};

export type EpisodeContext = {
  previousEpisode: Pick<Episode, "id" | "episodeNumber"> | null;
  currentEpisode: Pick<Episode, "id" | "episodeNumber">;
  nextEpisode: Pick<Episode, "id" | "episodeNumber"> | null;
};

export type PlaybackProgress = {
  profileId: string;
  episodeId?: string | null;
  movieId?: string | null;
  positionSeconds: number;
  durationSeconds: number;
  completed: boolean;
  lastWatchedAt: string;
};

export type ContinueWatchingItem = {
  profileId: string;
  positionSeconds: number;
  durationSeconds: number;
  completed: boolean;
  lastWatchedAt: string;
  kind: "episode" | "movie";
  episodeId?: string;
  movieId?: string;
  title: string;
  seriesTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  posterUrl?: string | null;
  backdropUrl?: string | null;
};

export type WatchHistoryEntry = {
  id: string;
  profileId: string;
  episodeId?: string | null;
  movieId?: string | null;
  watchedAt: string;
  completed: boolean;
};

export type WatchlistEntry = {
  id: string;
  profileId: string;
  seriesId?: string | null;
  movieId?: string | null;
  createdAt: string;
  series?: Series | null;
  movie?: Movie | null;
};

export type FavoriteEntry = {
  id: string;
  profileId: string;
  seriesId?: string | null;
  movieId?: string | null;
  createdAt: string;
  series?: Series | null;
  movie?: Movie | null;
};

// --- Discovery (AniZone metadata search/import) ---

export type AnizoneTag = {
  slug: string;
  url: string;
  name: string;
};

export type AnizoneSearchItem = {
  slug: string;
  sourceUrl: string;
  title: string;
  alternateTitles: Record<string, string> | null;
  coverUrl: string | null;
  type: string | null;
  isOngoing: boolean;
  isUnsafe: boolean;
  startYear: number | null;
  episodeCount: number | null;
  tags: AnizoneTag[];
};

export type AnizoneSearchResult = {
  items: AnizoneSearchItem[];
  hasMore: boolean;
};

export type AnizoneEpisode = {
  episodeNumber: number;
  title: string;
  sourceUrl: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthenticatedUser = {
  id: string;
  username: string;
  displayName: string;
};
