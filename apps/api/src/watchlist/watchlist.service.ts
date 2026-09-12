import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Profile, ProfileDocument } from "../database/schemas/profile.schema";
import { WatchlistItem, WatchlistItemDocument } from "../database/schemas/watchlist-item.schema";
import type { SeriesDocument } from "../database/schemas/series.schema";
import type { MovieDocument } from "../database/schemas/movie.schema";
import { assertOwnsProfile } from "../common/assert-owns-profile";
import { CreateWatchlistItemDto } from "./dto/create-watchlist-item.dto";

// After .populate(), Mongoose replaces the ref field itself with the populated
// document rather than adding a side-by-side property, but @streaming/types (and
// the web client) expect the Prisma-style shape: seriesId/movieId stay plain
// string ids, with separate nested `series`/`movie` objects alongside them.
function toWatchlistResponse(row: WatchlistItemDocument) {
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
export class WatchlistService {
  constructor(
    @InjectModel(Profile.name) private readonly profileModel: Model<ProfileDocument>,
    @InjectModel(WatchlistItem.name) private readonly watchlistModel: Model<WatchlistItemDocument>
  ) {}

  async list(userId: string, profileId: string) {
    await assertOwnsProfile(this.profileModel, userId, profileId);
    const rows = await this.watchlistModel
      .find({ profileId })
      .sort({ createdAt: "desc" })
      .populate("seriesId")
      .populate("movieId");
    return rows.map(toWatchlistResponse);
  }

  async add(userId: string, profileId: string, dto: CreateWatchlistItemDto) {
    await assertOwnsProfile(this.profileModel, userId, profileId);
    if (!dto.seriesId && !dto.movieId) {
      throw new BadRequestException("seriesId or movieId is required");
    }
    if (dto.seriesId && dto.movieId) {
      throw new BadRequestException("Provide only one of seriesId or movieId");
    }

    // No DB-level compound-unique index here (see watchlist-item.schema.ts note) —
    // find-then-create keeps "add" idempotent instead.
    const existing = await this.watchlistModel.findOne(
      dto.seriesId ? { profileId, seriesId: dto.seriesId } : { profileId, movieId: dto.movieId }
    );
    if (existing) return existing;

    return this.watchlistModel.create({ profileId, seriesId: dto.seriesId, movieId: dto.movieId });
  }

  async remove(userId: string, profileId: string, entryId: string) {
    await assertOwnsProfile(this.profileModel, userId, profileId);
    const entry = await this.watchlistModel.findById(entryId);
    if (!entry || entry.profileId.toString() !== profileId) throw new NotFoundException("Watchlist entry not found");
    await this.watchlistModel.deleteOne({ _id: entryId });
  }
}
