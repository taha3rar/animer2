import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { withJsonId } from "../mongoose-schema.util";

@Schema({ timestamps: true, collection: "users" })
export class User {
  @Prop({ required: true, unique: true })
  username!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ required: true })
  displayName!: string;

  @Prop()
  lastLoginAt?: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = withJsonId(SchemaFactory.createForClass(User));
