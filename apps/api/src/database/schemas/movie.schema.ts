import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { withJsonId } from "../mongoose-schema.util";
import { SubtitleTrack, SubtitleTrackSchema } from "./subtitle-track.schema";

@Schema({ timestamps: true, collection: "movies" })
export class Movie {
  @Prop({ required: true })
  title!: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  durationSeconds!: number;

  @Prop()
  posterUrl?: string;

  @Prop()
  backdropUrl?: string;

  @Prop()
  releaseYear?: number;

  @Prop({ required: true })
  videoUrl!: string;

  @Prop()
  chaptersUrl?: string;

  @Prop()
  storyboardUrl?: string;

  @Prop({ type: [SubtitleTrackSchema], default: [] })
  subtitles?: SubtitleTrack[];

  @Prop()
  introStartSeconds?: number;

  @Prop()
  introEndSeconds?: number;

  @Prop()
  creditsStartSeconds?: number;
}

export type MovieDocument = HydratedDocument<Movie>;
export const MovieSchema = withJsonId(SchemaFactory.createForClass(Movie));
