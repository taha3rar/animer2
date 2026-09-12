import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { withJsonId } from "../mongoose-schema.util";

// One row per profile+content. No DB-level unique index on (profileId, episodeId) /
// (profileId, movieId): Mongo treats multiple documents with the same missing/null
// field as duplicates under a unique index, which would break "movie rows all have
// episodeId = null". Uniqueness is enforced in playback.service.ts instead.
@Schema({ timestamps: true, collection: "playback_progress" })
export class PlaybackProgress {
  @Prop({ type: Types.ObjectId, ref: "Profile", required: true })
  profileId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Episode" })
  episodeId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Movie" })
  movieId?: Types.ObjectId;

  @Prop({ required: true })
  positionSeconds!: number;

  @Prop({ required: true })
  durationSeconds!: number;

  @Prop({ default: false })
  completed!: boolean;

  @Prop({ required: true, default: () => new Date() })
  lastWatchedAt!: Date;
}

export type PlaybackProgressDocument = HydratedDocument<PlaybackProgress>;
export const PlaybackProgressSchema = withJsonId(SchemaFactory.createForClass(PlaybackProgress));
PlaybackProgressSchema.index({ profileId: 1, episodeId: 1 });
PlaybackProgressSchema.index({ profileId: 1, movieId: 1 });
PlaybackProgressSchema.index({ profileId: 1, lastWatchedAt: 1 });
