import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

// Embedded (not its own collection) — always accessed as part of an
// Episode/Movie document, never queried independently.
@Schema({ _id: false })
export class SubtitleTrack {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  language!: string;

  @Prop({ required: true, enum: ["srt", "vtt", "ass"] })
  format!: "srt" | "vtt" | "ass";

  @Prop({ required: true })
  url!: string;

  @Prop({ default: false })
  default?: boolean;

  @Prop({ default: false })
  forced?: boolean;
}

export const SubtitleTrackSchema = SchemaFactory.createForClass(SubtitleTrack);
