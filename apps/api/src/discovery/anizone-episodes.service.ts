import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AnizoneEpisodeCache, AnizoneEpisodeCacheDocument } from "../database/schemas/anizone-episode-cache.schema";
import { parseEpisodeList } from "./anizone-episode-list.parser";

const ANIZONE_BASE_URL = "https://anizone.to/anime";

@Injectable()
export class AnizoneEpisodesService {
  constructor(
    @InjectModel(AnizoneEpisodeCache.name)
    private readonly cacheModel: Model<AnizoneEpisodeCacheDocument>
  ) {}

  // AniZone has no episode-list API — every episode page's sidebar happens to
  // list every episode, so episode 1's page is enough to learn the whole show's
  // episode count/titles. That page is plain server-rendered HTML (no Livewire
  // interaction needed, unlike search), so a plain fetch is enough — no browser.
  // The result never changes for a finished show, so it's scraped once per
  // slug and cached in Mongo instead of re-scraped per visit.
  async getEpisodeList(slug: string) {
    const cached = await this.cacheModel.findOne({ slug });
    if (cached) return cached.episodes;

    const episodes = await this.scrapeEpisodeList(slug);
    // Don't cache an empty result — it's more likely a transient scrape
    // failure (blocked/rate-limited/layout change) than a genuinely
    // episode-less show, and caching it would hide the failure forever.
    if (episodes.length > 0) {
      await this.cacheModel.create({ slug, episodes });
    }
    return episodes;
  }

  private async scrapeEpisodeList(slug: string) {
    const res = await fetch(`${ANIZONE_BASE_URL}/${slug}/1`);
    const html = await res.text();
    if (!res.ok) {
      throw new Error(`Failed to load AniZone episode page: ${res.status} | body: ${html.slice(0, 300)}`);
    }
    return parseEpisodeList(html);
  }
}
