import { Schema } from "mongoose";

/** Every schema uses this so JSON responses match the shared @streaming/types
 * shape (`id: string`) instead of leaking Mongoose's `_id`/`__v`. */
export function withJsonId<T>(schema: Schema<T>): Schema<T> {
  schema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = (ret._id as { toString(): string }).toString();
      delete ret._id;
      return ret;
    },
  });
  return schema;
}
