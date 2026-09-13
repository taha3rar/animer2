import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { withJsonId } from "../mongoose-schema.util";

@Schema({ timestamps: true, collection: "series" })
export class Series {
  @Prop({ required: true })
  title!: string;

  @Prop()
  description?: string;

  @Prop()
  posterUrl?: string;

  @Prop()
  backdropUrl?: string;

  @Prop()
  releaseYear?: number;

  // Set when imported from an external metadata source so re-importing the
  // same title is idempotent — see discovery.service.ts. Not unique: Mongo
  // would treat every manually-created series (both null) as a duplicate
  // under a unique index; dedup is find-then-create instead.
  @Prop()
  sourceSlug?: string;

  @Prop()
  sourceUrl?: string;

  // Which scraper sourceSlug belongs to — AniZone (HLS) and AnimeHeaven
  // (direct MP4) have completely different episode-list/video-resolution
  // mechanics, so getOrCreateEpisode needs to know which one to use.
  // Defaulted rather than required so existing AniZone-imported series don't
  // need a migration.
  @Prop({ enum: ["anizone", "animeheaven"], default: "anizone" })
  sourceProvider?: "anizone" | "animeheaven";

  // Explicit cross-reference to the SAME show's AniZone slug, used only to
  // borrow chapters.vtt/storyboard.vtt (Skip Intro + seek thumbnails) —
  // AnimeHeaven has neither. Deliberately a manually-set slug, not a
  // title-matched guess: two different releases can trim cold opens/credits
  // differently, so wiring the wrong show (or right show, wrong cut) would
  // silently produce a bad Skip Intro range. Video/audio still comes from
  // this series' own sourceSlug (AnimeHeaven); only chaptersUrl/
  // storyboardUrl per episode are borrowed from this slug.
  @Prop()
  chaptersSourceSlug?: string;
}

export type SeriesDocument = HydratedDocument<Series>;
export const SeriesSchema = withJsonId(SchemaFactory.createForClass(Series));
