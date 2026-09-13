import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { withJsonId } from "../mongoose-schema.util";

// Embedded — one entry per episode, never queried on its own. `hash` (not a
// URL) is AnimeHeaven's per-episode gate key — see AnimeheavenVideoService
// for how it turns into an actual playable video URL.
@Schema({ _id: false })
export class AnimeheavenEpisodeCacheEntry {
  @Prop({ required: true })
  episodeNumber!: number;

  @Prop({ required: true })
  hash!: string;
}

export const AnimeheavenEpisodeCacheEntrySchema = SchemaFactory.createForClass(AnimeheavenEpisodeCacheEntry);

// AnimeHeaven's series page lists every episode in one page (no separate
// listing API), and the result never changes for a finished show — scraped
// once per slug and cached here instead of redone on every visit. See
// AnimeheavenEpisodesService.
@Schema({ timestamps: true, collection: "animeheaven_episode_caches" })
export class AnimeheavenEpisodeCache {
  @Prop({ required: true, unique: true })
  slug!: string;

  @Prop({ type: [AnimeheavenEpisodeCacheEntrySchema], default: [] })
  episodes!: AnimeheavenEpisodeCacheEntry[];
}

export type AnimeheavenEpisodeCacheDocument = HydratedDocument<AnimeheavenEpisodeCache>;
export const AnimeheavenEpisodeCacheSchema = withJsonId(SchemaFactory.createForClass(AnimeheavenEpisodeCache));
