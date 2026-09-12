import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import { useProfileStore } from "../store/useProfileStore";
import { Row } from "../components/Row";
import { ContentCard } from "../components/ContentCard";
import { Focusable } from "../tv-navigation/Focusable";
import { useAutoFocus } from "../tv-navigation/useAutoFocus";

export function SeriesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const activeProfile = useProfileStore((s) => s.activeProfile)!;
  const queryClient = useQueryClient();

  const { data: series, isLoading } = useQuery({
    queryKey: ["series", id],
    queryFn: () => apiClient.getSeriesDetail(id!),
    enabled: !!id,
  });

  const { data: favorites } = useQuery({
    queryKey: ["favorites", activeProfile.id],
    queryFn: () => apiClient.getFavorites(activeProfile.id),
  });

  useAutoFocus([series]);

  if (isLoading) return <div className="center-message">Loading…</div>;
  if (!series) return <div className="center-message">Series not found.</div>;

  const favoriteEntry = favorites?.find((f) => f.seriesId === series.id);

  async function toggleFavorite() {
    if (favoriteEntry) {
      await apiClient.removeFavorite(activeProfile.id, favoriteEntry.id);
    } else {
      await apiClient.addFavorite(activeProfile.id, { seriesId: series!.id });
    }
    queryClient.invalidateQueries({ queryKey: ["favorites", activeProfile.id] });
  }

  return (
    <div className="screen">
      <div className="app-header">
        <span className="brand">{series.title}</span>
        <Focusable onClick={toggleFavorite}>
          {favoriteEntry ? "♥ Remove Favorite" : "♡ Add to Favorites"}
        </Focusable>
      </div>
      {series.description && <p>{series.description}</p>}

      {series.seasons.map((season) => (
        <Row key={season.id} title={season.title ?? `Season ${season.seasonNumber}`}>
          {season.episodes.map((episode) => (
            <ContentCard
              key={episode.id}
              title={`${episode.episodeNumber}. ${episode.title}`}
              imageUrl={episode.thumbnailUrl}
              onClick={() => navigate(`/watch/episode/${episode.id}`)}
            />
          ))}
        </Row>
      ))}
    </div>
  );
}
