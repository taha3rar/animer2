import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Series, SeriesDocument } from "../database/schemas/series.schema";
import { Season, SeasonDocument } from "../database/schemas/season.schema";
import { Episode, EpisodeDocument } from "../database/schemas/episode.schema";
import { Movie, MovieDocument } from "../database/schemas/movie.schema";
import { AnizoneEpisodesService } from "../discovery/anizone-episodes.service";
import { DiscoveryService } from "../discovery/discovery.service";

@Injectable()
export class ContentService {
  constructor(
    @InjectModel(Series.name) private readonly seriesModel: Model<SeriesDocument>,
    @InjectModel(Season.name) private readonly seasonModel: Model<SeasonDocument>,
    @InjectModel(Episode.name) private readonly episodeModel: Model<EpisodeDocument>,
    @InjectModel(Movie.name) private readonly movieModel: Model<MovieDocument>,
    private readonly anizoneEpisodesService: AnizoneEpisodesService,
    private readonly discoveryService: DiscoveryService
  ) {}

  getAllSeries() {
    return this.seriesModel.find().sort({ title: "asc" });
  }

  async getSeriesDetail(id: string) {
    const series = await this.seriesModel.findById(id);
    if (!series) throw new NotFoundException("Series not found");

    const seasons = await this.seasonModel.find({ seriesId: id }).sort({ seasonNumber: "asc" });
    const episodes = await this.episodeModel
      .find({ seasonId: { $in: seasons.map((s) => s.id) } })
      .sort({ episodeNumber: "asc" });

    const episodesBySeasonId = new Map<string, EpisodeDocument[]>();
    for (const episode of episodes) {
      const key = episode.seasonId.toString();
      if (!episodesBySeasonId.has(key)) episodesBySeasonId.set(key, []);
      episodesBySeasonId.get(key)!.push(episode);
    }

    return {
      ...series.toJSON(),
      seasons: seasons.map((season) => ({
        ...season.toJSON(),
        episodes: (episodesBySeasonId.get(season.id) ?? []).map((e) => e.toJSON()),
      })),
    };
  }

  getAllMovies() {
    return this.movieModel.find().sort({ title: "asc" });
  }

  async getMovie(id: string) {
    const movie = await this.movieModel.findById(id);
    if (!movie) throw new NotFoundException("Movie not found");
    return movie;
  }

  async getEpisode(id: string) {
    const episode = await this.episodeModel.findById(id);
    if (!episode) throw new NotFoundException("Episode not found");
    return episode;
  }

  async getEpisodeContext(id: string) {
    const current = await this.episodeModel.findById(id);
    if (!current) throw new NotFoundException("Episode not found");

    type EpisodeRef = { id: string; episodeNumber: number };
    const toRef = (doc: EpisodeDocument | null): EpisodeRef | null =>
      doc ? { id: doc.id, episodeNumber: doc.episodeNumber } : null;

    const seasonEpisodes = (
      await this.episodeModel.find({ seasonId: current.seasonId }).sort({ episodeNumber: "asc" })
    ).map(toRef) as EpisodeRef[];
    const index = seasonEpisodes.findIndex((e) => e.id === current.id);

    let previousEpisode = index > 0 ? seasonEpisodes[index - 1] : null;
    let nextEpisode =
      index >= 0 && index < seasonEpisodes.length - 1 ? seasonEpisodes[index + 1] : null;

    const season = await this.seasonModel.findById(current.seasonId);

    // Fall through to the neighboring season when at a season boundary, so
    // Next/Previous keeps working across season breaks like a real streaming app.
    if (!nextEpisode && season) {
      const nextSeason = await this.seasonModel
        .findOne({ seriesId: season.seriesId, seasonNumber: { $gt: season.seasonNumber } })
        .sort({ seasonNumber: "asc" });
      if (nextSeason) {
        nextEpisode = toRef(
          await this.episodeModel.findOne({ seasonId: nextSeason.id }).sort({ episodeNumber: "asc" })
        );
      }
    }

    if (!previousEpisode && season) {
      const prevSeason = await this.seasonModel
        .findOne({ seriesId: season.seriesId, seasonNumber: { $lt: season.seasonNumber } })
        .sort({ seasonNumber: "desc" });
      if (prevSeason) {
        previousEpisode = toRef(
          await this.episodeModel.findOne({ seasonId: prevSeason.id }).sort({ episodeNumber: "desc" })
        );
      }
    }

    // Neighbors resolve lazily (only scraped once someone watches them), so a
    // never-visited next/previous episode won't exist as an Episode doc yet.
    // Fall through to AniZone's full episode list and resolve it on demand —
    // same find-or-scrape DiscoveryService uses for "Watch Now" — instead of
    // reporting Next/Previous as unavailable just because no one clicked it yet.
    if ((!previousEpisode || !nextEpisode) && season) {
      const series = await this.seriesModel.findById(season.seriesId);
      if (series?.sourceSlug) {
        const anizoneEpisodes = await this.anizoneEpisodesService.getEpisodeList(series.sourceSlug);
        const hasNumber = (n: number) => anizoneEpisodes.some((e) => e.episodeNumber === n);

        if (!nextEpisode && hasNumber(current.episodeNumber + 1)) {
          nextEpisode = await this.discoveryService
            .getOrCreateEpisode(series.id, current.episodeNumber + 1)
            .then(toRef)
            .catch(() => null);
        }
        if (!previousEpisode && hasNumber(current.episodeNumber - 1)) {
          previousEpisode = await this.discoveryService
            .getOrCreateEpisode(series.id, current.episodeNumber - 1)
            .then(toRef)
            .catch(() => null);
        }
      }
    }

    return {
      previousEpisode,
      currentEpisode: { id: current.id, episodeNumber: current.episodeNumber },
      nextEpisode,
    };
  }
}
