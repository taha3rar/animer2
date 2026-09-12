import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Profile, ProfileDocument } from "../database/schemas/profile.schema";
import { ProfilePreferences, ProfilePreferencesDocument } from "../database/schemas/profile-preferences.schema";
import { PlaybackProgress, PlaybackProgressDocument } from "../database/schemas/playback-progress.schema";
import { WatchHistory, WatchHistoryDocument } from "../database/schemas/watch-history.schema";
import { WatchlistItem, WatchlistItemDocument } from "../database/schemas/watchlist-item.schema";
import { FavoriteItem, FavoriteItemDocument } from "../database/schemas/favorite-item.schema";
import { CreateProfileDto } from "./dto/create-profile.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class ProfilesService {
  constructor(
    @InjectModel(Profile.name) private readonly profileModel: Model<ProfileDocument>,
    @InjectModel(ProfilePreferences.name)
    private readonly preferencesModel: Model<ProfilePreferencesDocument>,
    @InjectModel(PlaybackProgress.name) private readonly progressModel: Model<PlaybackProgressDocument>,
    @InjectModel(WatchHistory.name) private readonly historyModel: Model<WatchHistoryDocument>,
    @InjectModel(WatchlistItem.name) private readonly watchlistModel: Model<WatchlistItemDocument>,
    @InjectModel(FavoriteItem.name) private readonly favoriteModel: Model<FavoriteItemDocument>
  ) {}

  findAllForUser(userId: string) {
    return this.profileModel.find({ userId }).sort({ createdAt: "asc" });
  }

  async create(userId: string, dto: CreateProfileDto) {
    const profile = await this.profileModel.create({
      userId,
      name: dto.name,
      avatarUrl: dto.avatarUrl,
      isKidsProfile: dto.isKidsProfile ?? false,
    });
    await this.preferencesModel.create({ profileId: profile.id });
    return profile;
  }

  async update(userId: string, profileId: string, dto: UpdateProfileDto) {
    const profile = await this.assertOwnership(userId, profileId);
    if (dto.name !== undefined) profile.name = dto.name;
    if (dto.avatarUrl !== undefined) profile.avatarUrl = dto.avatarUrl;
    await profile.save();
    return profile;
  }

  async remove(userId: string, profileId: string) {
    await this.assertOwnership(userId, profileId);
    // No DB-level cascade on Mongo — clean up every profile-scoped collection by hand.
    await Promise.all([
      this.profileModel.deleteOne({ _id: profileId }),
      this.preferencesModel.deleteOne({ profileId }),
      this.progressModel.deleteMany({ profileId }),
      this.historyModel.deleteMany({ profileId }),
      this.watchlistModel.deleteMany({ profileId }),
      this.favoriteModel.deleteMany({ profileId }),
    ]);
  }

  private async assertOwnership(userId: string, profileId: string): Promise<ProfileDocument> {
    const profile = await this.profileModel.findById(profileId);
    if (!profile) throw new NotFoundException("Profile not found");
    if (profile.userId.toString() !== userId) throw new ForbiddenException("Profile does not belong to this account");
    return profile;
  }
}
