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

  // Set when imported from an external metadata source (currently AniZone) so
  // re-importing the same title is idempotent — see discovery.service.ts.
  // Not unique: Mongo would treat every manually-created series (both null) as
  // a duplicate under a unique index; dedup is find-then-create instead.
  @Prop()
  sourceSlug?: string;

  @Prop()
  sourceUrl?: string;
}

export type SeriesDocument = HydratedDocument<Series>;
export const SeriesSchema = withJsonId(SchemaFactory.createForClass(Series));
