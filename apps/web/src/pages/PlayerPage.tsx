import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Html5PlayerAdapter } from "@streaming/player";
import type { PlayerAdapter } from "@streaming/player";
import {
  parseChapters,
  resolveIntroRange,
  parseStoryboard,
  findStoryboardCue,
  fetchSubtitleAsVttUrl,
} from "@streaming/player";
import type { SubtitleTrack } from "@streaming/types";
import { apiClient, toPlayableUrl } from "../lib/apiClient";
import { useProfileStore } from "../store/useProfileStore";
import { Focusable } from "../tv-navigation/Focusable";

const PROGRESS_SAVE_INTERVAL_MS = 10_000;
const CONTROLS_HIDE_DELAY_MS = 4_000;
const SEEK_STEP_SECONDS = 10;

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Plain-text VTT sidecar files, fetched straight from the source CDN (not our
// API), so a bare fetch is enough — react-query just gives us caching/dedup.
function useTextFile(url: string | null | undefined) {
  return useQuery({
    queryKey: ["textfile", url],
    queryFn: () => fetch(url!).then((res) => res.text()),
    enabled: !!url,
  });
}

export function PlayerPage() {
  const { kind, id } = useParams<{ kind: "episode" | "movie"; id: string }>();
  const navigate = useNavigate();
  const activeProfile = useProfileStore((s) => s.activeProfile)!;

  const videoRef = useRef<HTMLVideoElement>(null);
  const adapterRef = useRef<PlayerAdapter | null>(null);
  const scrubberRef = useRef<HTMLButtonElement>(null);
  const wasPlayingBeforeSeekRef = useRef(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);

  const [isSeeking, setIsSeeking] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);

  const [selectedSubtitle, setSelectedSubtitle] = useState<SubtitleTrack | null>(null);
  const [subtitleBlobUrl, setSubtitleBlobUrl] = useState<string | null>(null);
  const [subtitlesPanelOpen, setSubtitlesPanelOpen] = useState(false);

  const isEpisode = kind === "episode";

  const episodeQuery = useQuery({
    queryKey: ["episode", id],
    queryFn: () => apiClient.getEpisode(id!),
    enabled: isEpisode && !!id,
  });
  const movieQuery = useQuery({
    queryKey: ["movie", id],
    queryFn: () => apiClient.getMovie(id!),
    enabled: !isEpisode && !!id,
  });
  const contextQuery = useQuery({
    queryKey: ["episode-context", id],
    queryFn: () => apiClient.getEpisodeContext(id!),
    enabled: isEpisode && !!id,
  });
  const preferencesQuery = useQuery({
    queryKey: ["preferences", activeProfile.id],
    queryFn: () => apiClient.getPreferences(activeProfile.id),
  });
  const continueWatchingQuery = useQuery({
    queryKey: ["continue-watching", activeProfile.id],
    queryFn: () => apiClient.getContinueWatching(activeProfile.id),
  });

  const content = isEpisode ? episodeQuery.data : movieQuery.data;
  const preferences = preferencesQuery.data;
  const skipForward = preferences?.skipSecondsForward ?? 10;
  const skipBackward = preferences?.skipSecondsBackward ?? 10;

  // The VTT stuff is completely generic: every episode/movie just gives us
  // { videoUrl, chaptersUrl, storyboardUrl, subtitles } and everything below
  // (skip intro, seek-preview filmstrip, subtitle tracks) derives from that.
  // The *fetch* goes through toPlayableUrl (AniZone's CDN blocks direct
  // cross-origin fetches — see apiClient.ts) but cue URLs inside storyboard.vtt
  // must still resolve against the ORIGINAL url: a proxied URL's realpath is
  // just "/discovery/anizone/proxy" with the real target in the query string,
  // and relative-URL resolution doesn't know to preserve that.
  const chaptersFile = useTextFile(content?.chaptersUrl ? toPlayableUrl(content.chaptersUrl) : null);
  const storyboardFile = useTextFile(content?.storyboardUrl ? toPlayableUrl(content.storyboardUrl) : null);

  const chapters = useMemo(
    () => (chaptersFile.data ? parseChapters(chaptersFile.data) : []),
    [chaptersFile.data]
  );
  const storyboardCues = useMemo(
    () =>
      // The storyboard image itself is only ever used as a background-image,
      // which (unlike fetch/XHR) isn't CORS-restricted, so it's fine to point
      // straight at the CDN without proxying.
      storyboardFile.data && content?.storyboardUrl
        ? parseStoryboard(storyboardFile.data, content.storyboardUrl)
        : [],
    [storyboardFile.data, content?.storyboardUrl]
  );
  const introRange = useMemo(
    () => resolveIntroRange(chapters, content),
    [chapters, content?.introStartSeconds, content?.introEndSeconds]
  );
  const previewStoryboardCue = useMemo(
    () => (isSeeking ? findStoryboardCue(storyboardCues, previewTime) : undefined),
    [isSeeking, storyboardCues, previewTime]
  );

  const subtitleTracks = content?.subtitles ?? [];
  const showSkipIntro = !!introRange && currentTime >= introRange.start && currentTime < introRange.end;

  const resumeAt = useMemo(() => {
    const match = continueWatchingQuery.data?.find((item) =>
      isEpisode ? item.episodeId === id : item.movieId === id
    );
    return match?.positionSeconds ?? 0;
  }, [continueWatchingQuery.data, id, isEpisode]);

  const saveProgress = useCallback(
    (position: number, total: number) => {
      if (!id || total <= 0) return;
      apiClient
        .saveProgress(activeProfile.id, {
          episodeId: isEpisode ? id : undefined,
          movieId: isEpisode ? undefined : id,
          positionSeconds: Math.floor(position),
          durationSeconds: Math.floor(total),
        })
        .catch(() => {
          // best-effort: a dropped progress tick isn't worth surfacing to the viewer
        });
    },
    [activeProfile.id, id, isEpisode]
  );

  // Wire up the player adapter once the <video> element exists and content is known.
  useEffect(() => {
    if (!videoRef.current || !content) return;

    const adapter = new Html5PlayerAdapter(videoRef.current);
    adapterRef.current = adapter;

    adapter.load(toPlayableUrl(content.videoUrl), {
      autoplay: true,
      startAtSeconds: resumeAt > 5 ? resumeAt : 0,
    });

    const unsubs = [
      adapter.on("timeupdate", ({ currentTime, duration }) => {
        setCurrentTime(currentTime);
        setDuration(duration);
      }),
      adapter.on("play", () => setIsPaused(false)),
      adapter.on("pause", () => setIsPaused(true)),
      adapter.on("ended", () => {
        saveProgress(adapter.getDuration(), adapter.getDuration());
        if (isEpisode && preferences?.autoplayNextEpisode !== false && contextQuery.data?.nextEpisode) {
          navigate(`/watch/episode/${contextQuery.data.nextEpisode.id}`, { replace: true });
        }
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
      saveProgress(adapter.getCurrentTime(), adapter.getDuration());
      adapter.destroy();
      adapterRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content?.videoUrl]);

  // Pick the initial subtitle track from profile preferences once both are known.
  useEffect(() => {
    if (!subtitleTracks.length || !preferences || preferences.subtitlesEnabled === false) {
      setSelectedSubtitle(null);
      return;
    }
    const match =
      subtitleTracks.find((t) => t.language === preferences.preferredSubtitleLanguage) ??
      subtitleTracks.find((t) => t.default) ??
      null;
    setSelectedSubtitle(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content?.id, preferences?.subtitlesEnabled, preferences?.preferredSubtitleLanguage]);

  // Convert the selected subtitle (SRT or VTT) to a Blob URL and hand it to the
  // adapter — swaps the <track> in place without reloading/losing playback position.
  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    if (selectedSubtitle) {
      fetchSubtitleAsVttUrl({ ...selectedSubtitle, url: toPlayableUrl(selectedSubtitle.url) }).then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        createdUrl = url;
        setSubtitleBlobUrl(url);
      });
    } else {
      setSubtitleBlobUrl(null);
    }

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [selectedSubtitle]);

  useEffect(() => {
    adapterRef.current?.setSubtitleUrl(subtitleBlobUrl);
  }, [subtitleBlobUrl]);

  // Periodic progress save while playing.
  useEffect(() => {
    const interval = setInterval(() => {
      const adapter = adapterRef.current;
      if (adapter && !adapter.isPaused()) {
        saveProgress(adapter.getCurrentTime(), adapter.getDuration());
      }
    }, PROGRESS_SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [saveProgress]);

  // Save on tab/app close too, not just on unmount.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden" && adapterRef.current) {
        saveProgress(adapterRef.current.getCurrentTime(), adapterRef.current.getDuration());
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [saveProgress]);

  // Auto-hide controls after inactivity, like every other TV player. Any remote
  // keypress (not just mouse movement, since there's no mouse on a TV) brings them back.
  useEffect(() => {
    function showControls() {
      setControlsVisible(true);
    }
    window.addEventListener("keydown", showControls);
    return () => window.removeEventListener("keydown", showControls);
  }, []);

  useEffect(() => {
    if (isSeeking) return; // never hide the controls mid-scrub
    const timeout = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [currentTime, controlsVisible, isSeeking]);

  function togglePlayPause() {
    const adapter = adapterRef.current;
    if (!adapter) return;
    if (adapter.isPaused()) adapter.play();
    else adapter.pause();
  }

  function seekBy(seconds: number) {
    adapterRef.current?.seekBy(seconds);
  }

  function goToNeighborEpisode(episodeId: string | undefined) {
    if (!episodeId) return;
    if (adapterRef.current) saveProgress(adapterRef.current.getCurrentTime(), adapterRef.current.getDuration());
    navigate(`/watch/episode/${episodeId}`, { replace: true });
  }

  function skipIntro() {
    if (!introRange) return;
    adapterRef.current?.seekTo(introRange.end);
  }

  // --- Seek preview (Netflix/YouTube-style remote scrubbing) ---
  // LEFT/RIGHT move a "preview" position without touching real playback; OK
  // confirms (jumps the real video there), UP/DOWN cancels back to where
  // playback actually was. See requirements.md-style spec: actualTime vs
  // previewTime kept as two separate values, only merged on confirm.

  function enterSeekMode() {
    const adapter = adapterRef.current;
    if (!adapter || isSeeking) return;
    wasPlayingBeforeSeekRef.current = !adapter.isPaused();
    adapter.pause();
    setPreviewTime(currentTime);
    setIsSeeking(true);
  }

  function movePreview(deltaSeconds: number) {
    setPreviewTime((t) => Math.min(Math.max(t + deltaSeconds, 0), duration > 0 ? duration : t + deltaSeconds));
  }

  function confirmSeek() {
    adapterRef.current?.seekTo(previewTime);
    if (wasPlayingBeforeSeekRef.current) adapterRef.current?.play();
    setIsSeeking(false);
  }

  function cancelSeek() {
    setPreviewTime(currentTime);
    if (wasPlayingBeforeSeekRef.current) adapterRef.current?.play();
    setIsSeeking(false);
  }

  function handleScrubberKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      if (!isSeeking) enterSeekMode();
      movePreview(e.key === "ArrowLeft" ? -SEEK_STEP_SECONDS : SEEK_STEP_SECONDS);
      return;
    }
    if (isSeeking && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      e.stopPropagation();
      confirmSeek();
      return;
    }
    if (isSeeking && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      e.stopPropagation();
      cancelSeek();
    }
    // Not seeking + Up/Down: let it bubble so normal spatial nav moves focus away.
  }

  function selectSubtitle(track: SubtitleTrack | null) {
    setSelectedSubtitle(track);
    setSubtitlesPanelOpen(false);
    apiClient
      .updatePreferences(activeProfile.id, {
        subtitlesEnabled: track != null,
        ...(track ? { preferredSubtitleLanguage: track.language } : {}),
      })
      .catch(() => {
        // best-effort: subtitle choice still applies this session even if the save fails
      });
  }

  if ((isEpisode && episodeQuery.isLoading) || (!isEpisode && movieQuery.isLoading)) {
    return <div className="center-message">Loading…</div>;
  }
  if (!content) {
    return <div className="center-message">Content not found.</div>;
  }

  const title = content.title;
  const subtitle =
    isEpisode && episodeQuery.data
      ? `Episode ${episodeQuery.data.episodeNumber}`
      : undefined;

  const displayTime = isSeeking ? previewTime : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;

  return (
    <div className="player-shell" onMouseMove={() => setControlsVisible(true)}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} />

      {controlsVisible && (
        <div className="player-controls">
          <div className="player-title">
            {title}
            {subtitle ? ` — ${subtitle}` : ""}
          </div>

          <div className="player-scrubber-wrap">
            {isSeeking && (
              <div className="player-seek-preview" style={{ left: `${progressPercent}%` }}>
                {previewStoryboardCue && (
                  <div
                    className="player-seek-thumb"
                    style={{
                      backgroundImage: `url(${previewStoryboardCue.imageUrl})`,
                      backgroundPositionX: -previewStoryboardCue.x,
                      backgroundPositionY: -previewStoryboardCue.y,
                      width: previewStoryboardCue.width,
                      height: previewStoryboardCue.height,
                    }}
                  />
                )}
                <div className="player-seek-time">{formatTime(previewTime)}</div>
              </div>
            )}
            <Focusable
              ref={scrubberRef}
              className="player-scrubber"
              onKeyDown={handleScrubberKeyDown}
              aria-label="Seek"
            >
              <div className="player-progress-bar">
                <div className="player-progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            </Focusable>
          </div>

          <div className="player-time-row">
            <span>{formatTime(displayTime)}</span>
            <span>{formatTime(Math.max(duration - displayTime, 0))} remaining</span>
          </div>

          <div className="player-buttons">
            <Focusable
              disabled={!isEpisode || !contextQuery.data?.previousEpisode}
              onClick={() => goToNeighborEpisode(contextQuery.data?.previousEpisode?.id)}
            >
              ⏮ Previous
            </Focusable>
            <Focusable onClick={() => seekBy(-skipBackward)}>◀ {skipBackward}</Focusable>
            <Focusable onClick={togglePlayPause} autoFocus>
              {isPaused ? "▶ Play" : "⏸ Pause"}
            </Focusable>
            <Focusable onClick={() => seekBy(skipForward)}>{skipForward} ▶</Focusable>
            <Focusable
              disabled={!isEpisode || !contextQuery.data?.nextEpisode}
              onClick={() => goToNeighborEpisode(contextQuery.data?.nextEpisode?.id)}
            >
              Next ⏭
            </Focusable>
            {showSkipIntro && <Focusable onClick={skipIntro}>Skip Intro</Focusable>}
            {subtitleTracks.length > 0 && (
              <Focusable onClick={() => setSubtitlesPanelOpen((open) => !open)}>Subtitles</Focusable>
            )}
          </div>

          {subtitlesPanelOpen && (
            <div className="player-subtitles-panel">
              <Focusable
                className={selectedSubtitle == null ? "player-subtitle-active" : undefined}
                onClick={() => selectSubtitle(null)}
              >
                {selectedSubtitle == null ? "✓ " : ""}Off
              </Focusable>
              {subtitleTracks.map((track) => (
                <Focusable
                  key={track.url}
                  className={selectedSubtitle?.url === track.url ? "player-subtitle-active" : undefined}
                  onClick={() => selectSubtitle(track)}
                >
                  {selectedSubtitle?.url === track.url ? "✓ " : ""}
                  {track.title}
                </Focusable>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
