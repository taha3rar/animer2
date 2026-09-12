import { Controller, Body, Get, Param, ParseIntPipe, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AnizoneService } from "./anizone.service";
import { AnizoneEpisodesService } from "./anizone-episodes.service";
import { DiscoveryService } from "./discovery.service";
import { AnizoneSearchQueryDto } from "./dto/anizone-search-query.dto";
import { ImportAnizoneItemDto } from "./dto/import-anizone-item.dto";

@UseGuards(JwtAuthGuard)
@Controller("discovery/anizone")
export class DiscoveryController {
  constructor(
    private readonly anizoneService: AnizoneService,
    private readonly anizoneEpisodesService: AnizoneEpisodesService,
    private readonly discoveryService: DiscoveryService
  ) {}

  @Get("search")
  search(@Query() query: AnizoneSearchQueryDto) {
    return this.anizoneService.search(query.q);
  }

  @Post("import")
  import(@Body() dto: ImportAnizoneItemDto) {
    return this.discoveryService.importFromAnizone(dto);
  }

  @Get(":slug/episodes")
  getEpisodes(@Param("slug") slug: string) {
    return this.anizoneEpisodesService.getEpisodeList(slug);
  }

  // Resolves one episode on demand (Mongo find-or-scrape) — called right when
  // the player needs it, not as a bulk upfront import of the whole show.
  @Post("series/:seriesId/episode/:episodeNumber")
  getOrCreateEpisode(
    @Param("seriesId") seriesId: string,
    @Param("episodeNumber", ParseIntPipe) episodeNumber: number
  ) {
    return this.discoveryService.getOrCreateEpisode(seriesId, episodeNumber);
  }
}
