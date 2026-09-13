import { GatewayTimeoutException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  AnimeheavenEpisodeCache,
  AnimeheavenEpisodeCacheDocument,
} from "../database/schemas/animeheaven-episode-cache.schema";
import { parseAnimeheavenEpisodeList } from "./animeheaven-episode-list.parser";

const ANIMEHEAVEN_BASE_URL = "https://animeheaven.me";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

@Injectable()
export class AnimeheavenEpisodesService {
  constructor(
    @InjectModel(AnimeheavenEpisodeCache.name)
    private readonly cacheModel: Model<AnimeheavenEpisodeCacheDocument>
  ) {}

  // Same reasoning as AnizoneEpisodesService: the whole episode list lives on
  // one page and never changes for a finished show, so it's scraped once per
  // slug and cached in Mongo instead of re-scraped per visit.
  async getEpisodeList(slug: string) {
    const cached = await this.cacheModel.findOne({ slug });
    if (cached) return cached.episodes;

    const episodes = await this.scrapeEpisodeList(slug);
    if (episodes.length > 0) {
      await this.cacheModel.create({ slug, episodes });
    }
    return episodes;
  }

  private async scrapeEpisodeList(slug: string) {
    const res = await fetch(`${ANIMEHEAVEN_BASE_URL}/anime.php?${slug}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    const html = await res.text();
    if (!res.ok) {
      throw new GatewayTimeoutException(
        `Failed to load AnimeHeaven series page: ${res.status} | body: ${html.slice(0, 300)}`
      );
    }
    return parseAnimeheavenEpisodeList(html);
  }
}
