import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Profile, ProfileDocument } from "../database/schemas/profile.schema";
import { FavoriteItem, FavoriteItemDocument } from "../database/schemas/favorite-item.schema";
import type { SeriesDocument } from "../database/schemas/series.schema";
import type { MovieDocument } from "../database/schemas/movie.schema";
import { assertOwnsProfile } from "../common/assert-owns-profile";
import { CreateFavoriteDto } from "./dto/create-favorite.dto";

// See the identical note in watchlist.service.ts.
function toFavoriteResponse(row: FavoriteItemDocument) {
  const seriesDoc = row.seriesId as unknown as SeriesDocument | null;
  const movieDoc = row.movieId as unknown as MovieDocument | null;
  return {
    id: row.id,
    profileId: row.profileId.toString(),
    createdAt: row.createdAt,
    seriesId: seriesDoc?.id ?? null,
    movieId: movieDoc?.id ?? null,
    series: seriesDoc ? seriesDoc.toJSON() : null,
    movie: movieDoc ? movieDoc.toJSON() : null,
  };
}

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Profile.name) private readonly profileModel: Model<ProfileDocument>,
    @InjectModel(FavoriteItem.name) private readonly favoriteModel: Model<FavoriteItemDocument>
  ) {}

  async list(userId: string, profileId: string) {
    await assertOwnsProfile(this.profileModel, userId, profileId);
    const rows = await this.favoriteModel
      .find({ profileId })
      .sort({ createdAt: "desc" })
      .populate("seriesId")
      .populate("movieId");
    return rows.map(toFavoriteResponse);
  }

  async add(userId: string, profileId: string, dto: CreateFavoriteDto) {
    await assertOwnsProfile(this.profileModel, userId, profileId);
    if (!dto.seriesId && !dto.movieId) {
      throw new BadRequestException("seriesId or movieId is required");
    }
    if (dto.seriesId && dto.movieId) {
      throw new BadRequestException("Provide only one of seriesId or movieId");
    }

    // No DB-level compound-unique index here (see favorite-item.schema.ts note) —
    // find-then-create keeps "add" idempotent instead.
    const existing = await this.favoriteModel.findOne(
      dto.seriesId ? { profileId, seriesId: dto.seriesId } : { profileId, movieId: dto.movieId }
    );
    if (existing) return existing;

    return this.favoriteModel.create({ profileId, seriesId: dto.seriesId, movieId: dto.movieId });
  }

  async remove(userId: string, profileId: string, entryId: string) {
    await assertOwnsProfile(this.profileModel, userId, profileId);
    const entry = await this.favoriteModel.findById(entryId);
    if (!entry || entry.profileId.toString() !== profileId) throw new NotFoundException("Favorite entry not found");
    await this.favoriteModel.deleteOne({ _id: entryId });
  }
}
