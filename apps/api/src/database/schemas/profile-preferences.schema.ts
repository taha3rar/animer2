import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { withJsonId } from "../mongoose-schema.util";

@Schema({ timestamps: true, collection: "profile_preferences" })
export class ProfilePreferences {
  @Prop({ type: Types.ObjectId, ref: "Profile", required: true, unique: true })
  profileId!: Types.ObjectId;

  @Prop()
  preferredAudioLanguage?: string;

  @Prop()
  preferredSubtitleLanguage?: string;

  @Prop({ default: false })
  subtitlesEnabled!: boolean;

  @Prop({ default: true })
  autoplayNextEpisode!: boolean;

  @Prop({ default: 10 })
  skipSecondsForward!: number;

  @Prop({ default: 10 })
  skipSecondsBackward!: number;

  @Prop({ default: 1.0 })
  defaultPlaybackSpeed!: number;
}

export type ProfilePreferencesDocument = HydratedDocument<ProfilePreferences>;
export const ProfilePreferencesSchema = withJsonId(SchemaFactory.createForClass(ProfilePreferences));
