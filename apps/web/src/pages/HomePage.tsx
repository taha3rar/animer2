import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { AnizoneSearchItem } from "@streaming/types";
import { apiClient } from "../lib/apiClient";
import { useProfileStore } from "../store/useProfileStore";
import { Row } from "../components/Row";
import { ContentCard } from "../components/ContentCard";
import { AnizoneResultCard } from "../components/AnizoneResultCard";
import { AnizonePreviewModal } from "../components/AnizonePreviewModal";
import { Focusable } from "../tv-navigation/Focusable";

export function HomePage() {
  const navigate = useNavigate();
  const activeProfile = useProfileStore((s) => s.activeProfile)!;
  const clearActiveProfile = useProfileStore((s) => s.clearActiveProfile);
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [importingSlug, setImportingSlug] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<AnizoneSearchItem | null>(null);

  const continueWatching = useQuery({
    queryKey: ["continue-watching", activeProfile.id],
    queryFn: () => apiClient.getContinueWatching(activeProfile.id),
  });
  const series = useQuery({ queryKey: ["series"], queryFn: () => apiClient.getSeriesList() });
  const movies = useQuery({ queryKey: ["movies"], queryFn: () => apiClient.getMovies() });
  const favorites = useQuery({
    queryKey: ["favorites", activeProfile.id],
    queryFn: () => apiClient.getFavorites(activeProfile.id),
  });

  // Scraped from AniZone on demand — not something to pre-fetch, each search
  // drives a real headless browser on the API side (~a few seconds).
  const searchResults = useQuery({
    queryKey: ["anizone-search", submittedQuery],
    queryFn: () => apiClient.searchAnizone(submittedQuery),
    enabled: !!submittedQuery,
    retry: 0,
  });

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmittedQuery(searchInput.trim());
  }

  async function handleImport(item: AnizoneSearchItem) {
    setImportingSlug(item.slug);
    try {
      await apiClient.importAnizoneSeries({
        slug: item.slug,
        title: item.title,
        sourceUrl: item.sourceUrl,
        coverUrl: item.coverUrl ?? undefined,
        startYear: item.startYear ?? undefined,
      });
      // matchedSeries below is derived straight from this query, so once it
      // refetches the (now open) preview modal flips to its "in library" state.
      queryClient.invalidateQueries({ queryKey: ["series"] });
    } catch {
      // best-effort — the modal just stays on "+ Add to Library" so the user can retry
    } finally {
      setImportingSlug(null);
    }
  }

  const previewMatchedSeries = previewItem
    ? series.data?.find((s) => s.sourceSlug === previewItem.slug)
    : undefined;

  return (
    <div className="screen">
      <div className="app-header">
        <span className="brand">PrivateFlix</span>
        <Focusable
          onClick={() => {
            clearActiveProfile();
            navigate("/profiles");
          }}
        >
          {activeProfile.name} · Switch profile
        </Focusable>
      </div>

      <form className="search-bar" onSubmit={handleSearchSubmit}>
        <input
          type="search"
          placeholder="Search AniZone for anime to add…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          autoFocus
        />
        <Focusable type="submit" disabled={!searchInput.trim() || searchResults.isFetching}>
          {searchResults.isFetching ? "Searching…" : "Search"}
        </Focusable>
      </form>

      {searchResults.isError && (
        <p className="error-text">Couldn't reach AniZone — try again in a moment.</p>
      )}
      {submittedQuery && !searchResults.isFetching && searchResults.data?.items.length === 0 && (
        <p>No results for "{submittedQuery}".</p>
      )}

      {!!searchResults.data?.items.length && (
        <Row title={`Results for "${submittedQuery}"`}>
          {searchResults.data.items.map((item) => (
            <AnizoneResultCard
              key={item.slug}
              item={item}
              isInLibrary={!!series.data?.some((s) => s.sourceSlug === item.slug)}
              onClick={() => setPreviewItem(item)}
            />
          ))}
        </Row>
      )}

      {!!continueWatching.data?.length && (
        <Row title="Continue Watching">
          {continueWatching.data.map((item) => (
            <ContentCard
              key={`${item.kind}-${item.episodeId ?? item.movieId}`}
              title={item.kind === "episode" ? `${item.seriesTitle} — ${item.title}` : item.title}
              imageUrl={item.posterUrl}
              progressRatio={item.positionSeconds / Math.max(item.durationSeconds, 1)}
              onClick={() =>
                navigate(`/watch/${item.kind}/${item.episodeId ?? item.movieId}`)
              }
            />
          ))}
        </Row>
      )}

      {!!favorites.data?.length && (
        <Row title="Favorites">
          {favorites.data.map((entry) => {
            const content = entry.series ?? entry.movie;
            if (!content) return null;
            return (
              <ContentCard
                key={entry.id}
                title={content.title}
                imageUrl={content.posterUrl}
                onClick={() =>
                  navigate(entry.series ? `/series/${entry.series.id}` : `/watch/movie/${entry.movie!.id}`)
                }
              />
            );
          })}
        </Row>
      )}

      {!!series.data?.length && (
        <Row title="Series">
          {series.data.map((s) => (
            <ContentCard
              key={s.id}
              title={s.title}
              imageUrl={s.posterUrl}
              onClick={() => navigate(`/series/${s.id}`)}
            />
          ))}
        </Row>
      )}

      {!!movies.data?.length && (
        <Row title="Movies">
          {movies.data.map((m) => (
            <ContentCard
              key={m.id}
              title={m.title}
              imageUrl={m.posterUrl}
              onClick={() => navigate(`/watch/movie/${m.id}`)}
            />
          ))}
        </Row>
      )}

      {previewItem && (
        <AnizonePreviewModal
          item={previewItem}
          matchedSeries={previewMatchedSeries}
          continueWatching={continueWatching.data}
          isImporting={importingSlug === previewItem.slug}
          onImport={() => handleImport(previewItem)}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
}
