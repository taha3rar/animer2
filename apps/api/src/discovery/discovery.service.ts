import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Series, SeriesDocument } from "../database/schemas/series.schema";
import { Season, SeasonDocument } from "../database/schemas/season.schema";
import { Episode, EpisodeDocument } from "../database/schemas/episode.schema";
import { AnizoneEpisodesService } from "./anizone-episodes.service";
import { AnizoneVideoService } from "./anizone-video.service";
import { AnimeheavenEpisodesService } from "./animeheaven-episodes.service";
import { AnimeheavenVideoService } from "./animeheaven-video.service";
import { ImportAnizoneItemDto } from "./dto/import-anizone-item.dto";
import { ImportAnimeheavenItemDto } from "./dto/import-animeheaven-item.dto";

@Injectable()
export class DiscoveryService {
  constructor(
    @InjectModel(Series.name) private readonly seriesModel: Model<SeriesDocument>,
    @InjectModel(Season.name) private readonly seasonModel: Model<SeasonDocument>,
    @InjectModel(Episode.name) private readonly episodeModel: Model<EpisodeDocument>,
    private readonly anizoneEpisodesService: AnizoneEpisodesService,
    private readonly anizoneVideoService: AnizoneVideoService,
    private readonly animeheavenEpisodesService: AnimeheavenEpisodesService,
    private readonly animeheavenVideoService: AnimeheavenVideoService
  ) {}

  // Find-then-create keeps re-importing the same AniZone title idempotent
  // instead of erroring — see the sourceSlug note on the Series schema.
  async importFromAnizone(dto: ImportAnizoneItemDto) {
    const existing = await this.seriesModel.findOne({ sourceSlug: dto.slug, sourceProvider: "anizone" });
    if (existing) return existing;

    return this.seriesModel.create({
      title: dto.title,
      posterUrl: dto.coverUrl,
      releaseYear: dto.startYear,
      sourceSlug: dto.slug,
      sourceUrl: dto.sourceUrl,
      sourceProvider: "anizone",
    });
  }

  async importFromAnimeheaven(dto: ImportAnimeheavenItemDto) {
    const existing = await this.seriesModel.findOne({ sourceSlug: dto.slug, sourceProvider: "animeheaven" });
    if (existing) return existing;

    return this.seriesModel.create({
      title: dto.title,
      posterUrl: dto.coverUrl,
      sourceSlug: dto.slug,
      sourceUrl: `https://animeheaven.me/anime.php?${dto.slug}`,
      sourceProvider: "animeheaven",
    });
  }

  // Resolves ONE episode on demand — called when the player actually needs it
  // (Watch Now), not as a bulk upfront import. Mongo find-or-scrape, same
  // pattern as the episode list: already a real Episode record -> return it
  // instantly; otherwise scrape just that one episode page and persist it.
  async getOrCreateEpisode(seriesId: string, episodeNumber: number) {
    const series = await this.seriesModel.findById(seriesId);
    if (!series) throw new NotFoundException("Series not found");
    if (!series.sourceSlug) throw new NotFoundException("Series has no external source to fetch episodes from");

    let season = await this.seasonModel.findOne({ seriesId: series.id, seasonNumber: 1 });
    if (!season) {
      season = await this.seasonModel.create({ seriesId: series.id, seasonNumber: 1 });
    }

    const existing = await this.episodeModel.findOne({ seasonId: season.id, episodeNumber });
    if (existing) return existing;

    if (series.sourceProvider === "animeheaven") {
      return this.getOrCreateAnimeheavenEpisode(
        series.sourceSlug,
        season.id,
        episodeNumber,
        series.chaptersSourceSlug
      );
    }
    return this.getOrCreateAnizoneEpisode(series.sourceSlug, season.id, episodeNumber);
  }

  // AniZone's own HLS src/chapters/storyboard/subtitles are used as-is for this
  // demo — every field written here already exists on the Episode schema for
  // the later swap to a real source (Crunchyroll), only where the values come
  // from changes.
  private async getOrCreateAnizoneEpisode(slug: string, seasonId: string, episodeNumber: number) {
    const episodeList = await this.anizoneEpisodesService.getEpisodeList(slug);
    const listEntry = episodeList.find((ep) => ep.episodeNumber === episodeNumber);
    if (!listEntry) throw new NotFoundException(`Episode ${episodeNumber} not found for this series`);

    const video = await this.anizoneVideoService.getEpisodeVideo(slug, episodeNumber);
    if (!video) throw new NotFoundException(`Could not resolve video for episode ${episodeNumber}`);

    return this.episodeModel.create({
      seasonId,
      episodeNumber,
      title: listEntry.title,
      durationSeconds: video.durationSeconds,
      videoUrl: video.videoUrl,
      chaptersUrl: video.chaptersUrl,
      storyboardUrl: video.storyboardUrl,
      subtitles: video.subtitles,
    });
  }

  // AnimeHeaven exposes none of AniZone's extras (chapters/storyboard/
  // subtitles, or even a per-episode title) — just a direct, standard-codec
  // MP4 per episode. See animeheaven-video.service.ts for why resolving the
  // actual URL needs a live gate.php request rather than a stored value.
  private async getOrCreateAnimeheavenEpisode(
    slug: string,
    seasonId: string,
    episodeNumber: number,
    chaptersSourceSlug?: string
  ) {
    const episodeList = await this.animeheavenEpisodesService.getEpisodeList(slug);
    const listEntry = episodeList.find((ep) => ep.episodeNumber === episodeNumber);
    if (!listEntry) throw new NotFoundException(`Episode ${episodeNumber} not found for this series`);

    const videoUrl = await this.animeheavenVideoService.resolveVideoUrl(listEntry.hash, slug);
    if (!videoUrl) throw new NotFoundException(`Could not resolve video for episode ${episodeNumber}`);

    // Video/audio always comes from AnimeHeaven above — this only ever
    // borrows the two sidecar files AnimeHeaven doesn't have. Best-effort:
    // a missing/failed chapters lookup just means no Skip Intro for this
    // episode, not a broken episode.
    let chaptersUrl: string | null = null;
    let storyboardUrl: string | null = null;
    let durationSeconds = 0;
    if (chaptersSourceSlug) {
      try {
        const chapterSource = await this.anizoneVideoService.getEpisodeVideo(chaptersSourceSlug, episodeNumber);
        chaptersUrl = chapterSource?.chaptersUrl ?? null;
        storyboardUrl = chapterSource?.storyboardUrl ?? null;
        durationSeconds = chapterSource?.durationSeconds ?? 0;
      } catch {
        // Best-effort — proceed without chapters/storyboard for this episode.
      }
    }

    return this.episodeModel.create({
      seasonId,
      episodeNumber,
      title: `Episode ${episodeNumber}`,
      durationSeconds,
      videoUrl,
      chaptersUrl,
      storyboardUrl,
    });
  }
}
