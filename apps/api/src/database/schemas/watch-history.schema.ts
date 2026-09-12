import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { withJsonId } from "../mongoose-schema.util";

@Schema({ collection: "watch_history" })
export class WatchHistory {
  @Prop({ type: Types.ObjectId, ref: "Profile", required: true })
  profileId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Episode" })
  episodeId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Movie" })
  movieId?: Types.ObjectId;

  @Prop({ required: true, default: () => new Date() })
  watchedAt!: Date;

  @Prop({ required: true })
  completed!: boolean;
}

export type WatchHistoryDocument = HydratedDocument<WatchHistory>;
export const WatchHistorySchema = withJsonId(SchemaFactory.createForClass(WatchHistory));
WatchHistorySchema.index({ profileId: 1, watchedAt: 1 });
