import { Controller, Body, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AnimeheavenService } from "./animeheaven.service";
import { AnimeheavenEpisodesService } from "./animeheaven-episodes.service";
import { DiscoveryService } from "./discovery.service";
import { AnizoneSearchQueryDto } from "./dto/anizone-search-query.dto";
import { ImportAnimeheavenItemDto } from "./dto/import-animeheaven-item.dto";

// Deliberately its own controller/prefix (not folded into DiscoveryController,
// which lives under discovery/anizone) — the generic
// discovery/anizone/series/:seriesId/episode/:episodeNumber route already
// handles both providers internally (see DiscoveryService.getOrCreateEpisode),
// but search/import need provider-specific request shapes.
@UseGuards(JwtAuthGuard)
@Controller("discovery/animeheaven")
export class AnimeheavenController {
  constructor(
    private readonly animeheavenService: AnimeheavenService,
    private readonly animeheavenEpisodesService: AnimeheavenEpisodesService,
    private readonly discoveryService: DiscoveryService
  ) {}

  @Get("search")
  search(@Query() query: AnizoneSearchQueryDto) {
    return this.animeheavenService.search(query.q);
  }

  @Post("import")
  import(@Body() dto: ImportAnimeheavenItemDto) {
    return this.discoveryService.importFromAnimeheaven(dto);
  }

  // Shaped like AnizoneEpisode (episodeNumber/title/sourceUrl) so the
  // existing preview-modal episode list works unchanged — AnimeHeaven has no
  // per-episode title, so it's synthesized as "Episode N", and the per-
  // episode gate hash isn't a stable URL (see animeheaven-video.service.ts),
  // so sourceUrl just points at the series page.
  @Get(":slug/episodes")
  async getEpisodes(@Param("slug") slug: string) {
    const episodes = await this.animeheavenEpisodesService.getEpisodeList(slug);
    return episodes.map((ep) => ({
      episodeNumber: ep.episodeNumber,
      title: `Episode ${ep.episodeNumber}`,
      sourceUrl: `https://animeheaven.me/anime.php?${slug}`,
    }));
  }
}
