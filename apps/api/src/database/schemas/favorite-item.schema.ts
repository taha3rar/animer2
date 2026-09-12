import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { withJsonId } from "../mongoose-schema.util";

// See the note on PlaybackProgress — same reasoning, uniqueness enforced in
// favorites.service.ts instead of a DB constraint.
@Schema({ collection: "favorite_items" })
export class FavoriteItem {
  @Prop({ type: Types.ObjectId, ref: "Profile", required: true })
  profileId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Series" })
  seriesId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Movie" })
  movieId?: Types.ObjectId;

  @Prop({ required: true, default: () => new Date() })
  createdAt!: Date;
}

export type FavoriteItemDocument = HydratedDocument<FavoriteItem>;
export const FavoriteItemSchema = withJsonId(SchemaFactory.createForClass(FavoriteItem));
FavoriteItemSchema.index({ profileId: 1, seriesId: 1 });
FavoriteItemSchema.index({ profileId: 1, movieId: 1 });
