import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { AnizoneSearchItem, ContinueWatchingItem, Series } from "@streaming/types";
import { apiClient } from "../lib/apiClient";
import { Focusable } from "../tv-navigation/Focusable";
import { focusFirstAvailable } from "../tv-navigation/spatialNavigation";

// Same "GoBack" (LG remote) / Backspace / Escape (dev keyboard) set useTvNavigation
// treats as Back — here it closes the modal instead of navigating the page away.
const BACK_KEYS = new Set(["GoBack", "Backspace", "Escape"]);

type AnizonePreviewModalProps = {
  item: AnizoneSearchItem;
  matchedSeries: Series | undefined;
  continueWatching: ContinueWatchingItem[] | undefined;
  isImporting: boolean;
  onImport: () => void;
  onClose: () => void;
};

export function AnizonePreviewModal({
  item,
  matchedSeries,
  continueWatching,
  isImporting,
  onImport,
  onClose,
}: AnizonePreviewModalProps) {
  const navigate = useNavigate();
  const [isResolvingEpisode, setIsResolvingEpisode] = useState(false);

  // AniZone's own episode count for this show — informational, independent of
  // how many (if any) of those episodes actually exist as playable Episode
  // records in our library yet.
  const episodesQuery = useQuery({
    queryKey: ["anizone-episodes", item.slug],
    queryFn: () => apiClient.getAnizoneEpisodes(item.slug),
    staleTime: Infinity,
  });

  const seriesDetailQuery = useQuery({
    queryKey: ["series", matchedSeries?.id],
    queryFn: () => apiClient.getSeriesDetail(matchedSeries!.id),
    enabled: !!matchedSeries,
  });

  const isLoadingLibraryState = !!matchedSeries && seriesDetailQuery.isLoading;
  const firstEpisode = seriesDetailQuery.data?.seasons[0]?.episodes[0];

  const currentProgress = useMemo(() => {
    if (!seriesDetailQuery.data) return null;
    const episodeIds = new Set(
      seriesDetailQuery.data.seasons.flatMap((season) => season.episodes.map((ep) => ep.id))
    );
    return continueWatching?.find((cw) => cw.episodeId && episodeIds.has(cw.episodeId)) ?? null;
  }, [seriesDetailQuery.data, continueWatching]);

  // Re-focus the primary action once we actually know which one to show.
  useEffect(() => {
    const id = requestAnimationFrame(() => focusFirstAvailable());
    return () => cancelAnimationFrame(id);
  }, [isLoadingLibraryState, matchedSeries]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (BACK_KEYS.has(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  }

  // On demand, not a bulk import: if we already have a playable episode (or
  // progress pointing at one), jump straight there. Otherwise resolve just
  // episode 1 (server does a Mongo find-or-scrape) and go once that's ready.
  async function watchNow() {
    const knownEpisodeId = currentProgress?.episodeId ?? firstEpisode?.id;
    if (knownEpisodeId) {
      onClose();
      navigate(`/watch/episode/${knownEpisodeId}`);
      return;
    }
    if (!matchedSeries) return;

    setIsResolvingEpisode(true);
    try {
      const episode = await apiClient.resolveAnizoneEpisode(matchedSeries.id, 1);
      onClose();
      navigate(`/watch/episode/${episode.id}`);
    } catch {
      // best-effort — the button just stays available so the user can retry
    } finally {
      setIsResolvingEpisode(false);
    }
  }

  const meta = [item.type, item.startYear].filter(Boolean).join(" · ");
  const episodeCount = episodesQuery.data?.length;

  return (
    <div className="modal-backdrop" data-modal-root onClick={onClose}>
      <div className="modal-panel" onKeyDown={handleKeyDown} onClick={(e) => e.stopPropagation()}>
        {item.coverUrl && <img className="modal-cover" src={item.coverUrl} alt="" />}
        <div className="modal-body">
          <h2>{item.title}</h2>
          <p className="modal-meta">
            {meta}
            {typeof episodeCount === "number" &&
              ` · ${episodeCount} episode${episodeCount === 1 ? "" : "s"}`}
            {episodesQuery.isFetching && " · counting episodes…"}
          </p>
          {!!item.tags.length && (
            <p className="modal-tags">{item.tags.map((t) => t.name).join(", ")}</p>
          )}

          {currentProgress && (
            <p className="modal-progress">
              Continue: S{currentProgress.seasonNumber} E{currentProgress.episodeNumber} —{" "}
              {currentProgress.title}
            </p>
          )}

          <div className="modal-actions">
            {isLoadingLibraryState ? (
              <span className="modal-hint">Loading…</span>
            ) : matchedSeries ? (
              <Focusable onClick={watchNow} disabled={isResolvingEpisode}>
                {isResolvingEpisode
                  ? "Loading episode…"
                  : `▶ ${currentProgress ? "Continue Watching" : "Watch Now"}`}
              </Focusable>
            ) : (
              <Focusable onClick={onImport} disabled={isImporting}>
                {isImporting ? "Adding…" : "+ Add to Library"}
              </Focusable>
            )}
            <Focusable onClick={onClose}>Close</Focusable>
          </div>
        </div>
      </div>
    </div>
  );
}
