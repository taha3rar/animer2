import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { withJsonId } from "../mongoose-schema.util";

// Embedded — one entry per episode, never queried on its own.
@Schema({ _id: false })
export class AnizoneEpisodeCacheEntry {
  @Prop({ required: true })
  episodeNumber!: number;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  sourceUrl!: string;
}

export const AnizoneEpisodeCacheEntrySchema = SchemaFactory.createForClass(AnizoneEpisodeCacheEntry);

// AniZone doesn't expose an episode-count/listing API — the only way to find it is
// to load anime/{slug}/1 and read the sidebar episode list out of the page HTML.
// That's expensive (a real browser navigation) and the result never changes for a
// finished show, so it's scraped once per slug and cached here instead of redone
// on every visit. See AnizoneEpisodesService.
@Schema({ timestamps: true, collection: "anizone_episode_caches" })
export class AnizoneEpisodeCache {
  @Prop({ required: true, unique: true })
  slug!: string;

  @Prop({ type: [AnizoneEpisodeCacheEntrySchema], default: [] })
  episodes!: AnizoneEpisodeCacheEntry[];
}

export type AnizoneEpisodeCacheDocument = HydratedDocument<AnizoneEpisodeCache>;
export const AnizoneEpisodeCacheSchema = withJsonId(SchemaFactory.createForClass(AnizoneEpisodeCache));
