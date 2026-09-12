import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { withJsonId } from "../mongoose-schema.util";

// See the note on PlaybackProgress — same reasoning, uniqueness enforced in
// watchlist.service.ts instead of a DB constraint.
@Schema({ collection: "watchlist_items" })
export class WatchlistItem {
  @Prop({ type: Types.ObjectId, ref: "Profile", required: true })
  profileId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Series" })
  seriesId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Movie" })
  movieId?: Types.ObjectId;

  @Prop({ required: true, default: () => new Date() })
  createdAt!: Date;
}

export type WatchlistItemDocument = HydratedDocument<WatchlistItem>;
export const WatchlistItemSchema = withJsonId(SchemaFactory.createForClass(WatchlistItem));
WatchlistItemSchema.index({ profileId: 1, seriesId: 1 });
WatchlistItemSchema.index({ profileId: 1, movieId: 1 });
