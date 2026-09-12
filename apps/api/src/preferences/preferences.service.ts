import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Profile, ProfileDocument } from "../database/schemas/profile.schema";
import { ProfilePreferences, ProfilePreferencesDocument } from "../database/schemas/profile-preferences.schema";
import { assertOwnsProfile } from "../common/assert-owns-profile";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";

@Injectable()
export class PreferencesService {
  constructor(
    @InjectModel(Profile.name) private readonly profileModel: Model<ProfileDocument>,
    @InjectModel(ProfilePreferences.name)
    private readonly preferencesModel: Model<ProfilePreferencesDocument>
  ) {}

  async get(userId: string, profileId: string) {
    await assertOwnsProfile(this.profileModel, userId, profileId);
    return this.preferencesModel.findOneAndUpdate(
      { profileId },
      { $setOnInsert: { profileId } },
      { upsert: true, new: true }
    );
  }

  async update(userId: string, profileId: string, dto: UpdatePreferencesDto) {
    await assertOwnsProfile(this.profileModel, userId, profileId);
    return this.preferencesModel.findOneAndUpdate(
      { profileId },
      { $set: dto, $setOnInsert: { profileId } },
      { upsert: true, new: true }
    );
  }
}
