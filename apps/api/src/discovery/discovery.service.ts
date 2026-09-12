import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Series, SeriesDocument } from "../database/schemas/series.schema";
import { Season, SeasonDocument } from "../database/schemas/season.schema";
import { Episode, EpisodeDocument } from "../database/schemas/episode.schema";
import { AnizoneEpisodesService } from "./anizone-episodes.service";
import { AnizoneVideoService } from "./anizone-video.service";
import { ImportAnizoneItemDto } from "./dto/import-anizone-item.dto";

@Injectable()
export class DiscoveryService {
  constructor(
    @InjectModel(Series.name) private readonly seriesModel: Model<SeriesDocument>,
    @InjectModel(Season.name) private readonly seasonModel: Model<SeasonDocument>,
    @InjectModel(Episode.name) private readonly episodeModel: Model<EpisodeDocument>,
    private readonly anizoneEpisodesService: AnizoneEpisodesService,
    private readonly anizoneVideoService: AnizoneVideoService
  ) {}

  // Find-then-create keeps re-importing the same AniZone title idempotent
  // instead of erroring — see the sourceSlug note on the Series schema.
  async importFromAnizone(dto: ImportAnizoneItemDto) {
    const existing = await this.seriesModel.findOne({ sourceSlug: dto.slug });
    if (existing) return existing;

    return this.seriesModel.create({
      title: dto.title,
      posterUrl: dto.coverUrl,
      releaseYear: dto.startYear,
      sourceSlug: dto.slug,
      sourceUrl: dto.sourceUrl,
    });
  }

  // Resolves ONE episode on demand — called when the player actually needs it
  // (Watch Now), not as a bulk upfront import. Mongo find-or-scrape, same
  // pattern as the episode list: already a real Episode record -> return it
  // instantly; otherwise scrape just that one episode page and persist it.
  // AniZone's own HLS src/chapters/storyboard/subtitles are used as-is for this
  // demo — every field written here already exists on the Episode schema for
  // the later swap to a real source (Crunchyroll), only where the values come
  // from changes.
  async getOrCreateEpisode(seriesId: string, episodeNumber: number) {
    const series = await this.seriesModel.findById(seriesId);
    if (!series) throw new NotFoundException("Series not found");
    if (!series.sourceSlug) throw new NotFoundException("Series has no AniZone source to fetch episodes from");

    let season = await this.seasonModel.findOne({ seriesId: series.id, seasonNumber: 1 });
    if (!season) {
      season = await this.seasonModel.create({ seriesId: series.id, seasonNumber: 1 });
    }

    const existing = await this.episodeModel.findOne({ seasonId: season.id, episodeNumber });
    if (existing) return existing;

    const episodeList = await this.anizoneEpisodesService.getEpisodeList(series.sourceSlug);
    const listEntry = episodeList.find((ep) => ep.episodeNumber === episodeNumber);
    if (!listEntry) throw new NotFoundException(`Episode ${episodeNumber} not found for this series`);

    const video = await this.anizoneVideoService.getEpisodeVideo(series.sourceSlug, episodeNumber);
    if (!video) throw new NotFoundException(`Could not resolve video for episode ${episodeNumber}`);

    return this.episodeModel.create({
      seasonId: season.id,
      episodeNumber,
      title: listEntry.title,
      durationSeconds: video.durationSeconds,
      videoUrl: video.videoUrl,
      chaptersUrl: video.chaptersUrl,
      storyboardUrl: video.storyboardUrl,
      subtitles: video.subtitles,
    });
  }
}
