import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { withJsonId } from "../mongoose-schema.util";

@Schema({ timestamps: true, collection: "profiles" })
export class Profile {
  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ default: false })
  isKidsProfile!: boolean;

  @Prop()
  pinHash?: string;
}

export type ProfileDocument = HydratedDocument<Profile>;
export const ProfileSchema = withJsonId(SchemaFactory.createForClass(Profile));
