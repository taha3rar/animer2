import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { withJsonId } from "../mongoose-schema.util";

@Schema({ timestamps: true, collection: "refresh_tokens" })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  tokenHash!: string;

  @Prop({ default: false })
  revoked!: boolean;

  @Prop({ required: true })
  expiresAt!: Date;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenSchema = withJsonId(SchemaFactory.createForClass(RefreshToken));
