import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Model } from "mongoose";
import type { ProfileDocument } from "../database/schemas/profile.schema";

/** Every profile-scoped route trusts the :profileId param — this is the one check that
 * keeps user A from reading/writing user B's profile data via a guessed profile id. */
export async function assertOwnsProfile(
  profileModel: Model<ProfileDocument>,
  userId: string,
  profileId: string
): Promise<void> {
  const profile = await profileModel.findById(profileId);
  if (!profile) throw new NotFoundException("Profile not found");
  if (profile.userId.toString() !== userId) throw new ForbiddenException("Profile does not belong to this account");
}
