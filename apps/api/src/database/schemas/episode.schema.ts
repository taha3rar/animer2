import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { withJsonId } from "../mongoose-schema.util";
import { SubtitleTrack, SubtitleTrackSchema } from "./subtitle-track.schema";

@Schema({ timestamps: true, collection: "episodes" })
export class Episode {
  @Prop({ type: Types.ObjectId, ref: "Season", required: true, index: true })
  seasonId!: Types.ObjectId;

  @Prop({ required: true })
  episodeNumber!: number;

  @Prop({ required: true })
  title!: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  durationSeconds!: number;

  @Prop()
  thumbnailUrl?: string;

  @Prop({ required: true })
  videoUrl!: string;

  // Skip Intro chapter markers and the seek-preview filmstrip — optional WebVTT
  // sidecar files. When absent, the player just has no Skip Intro / storyboard.
  @Prop()
  chaptersUrl?: string;

  @Prop()
  storyboardUrl?: string;

  @Prop({ type: [SubtitleTrackSchema], default: [] })
  subtitles?: SubtitleTrack[];

  // DB override for the rare episode whose intro doesn't match "chapter 1 of
  // chapters.vtt" (cold open, different chapter layout, etc) — wins over the
  // chapters.vtt-derived range when set. See packages/player's resolveIntroRange.
  @Prop()
  introStartSeconds?: number;

  @Prop()
  introEndSeconds?: number;

  @Prop()
  creditsStartSeconds?: number;
}

export type EpisodeDocument = HydratedDocument<Episode>;
export const EpisodeSchema = withJsonId(SchemaFactory.createForClass(Episode));
EpisodeSchema.index({ seasonId: 1, episodeNumber: 1 }, { unique: true });
