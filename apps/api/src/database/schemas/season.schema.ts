import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { withJsonId } from "../mongoose-schema.util";

@Schema({ timestamps: true, collection: "seasons" })
export class Season {
  @Prop({ type: Types.ObjectId, ref: "Series", required: true, index: true })
  seriesId!: Types.ObjectId;

  @Prop({ required: true })
  seasonNumber!: number;

  @Prop()
  title?: string;

  @Prop()
  posterUrl?: string;
}

export type SeasonDocument = HydratedDocument<Season>;
export const SeasonSchema = withJsonId(SchemaFactory.createForClass(Season));
SeasonSchema.index({ seriesId: 1, seasonNumber: 1 }, { unique: true });
