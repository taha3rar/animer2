import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { ContinueWatchingItem } from "@streaming/types";
import { Profile, ProfileDocument } from "../database/schemas/profile.schema";
import { PlaybackProgress, PlaybackProgressDocument } from "../database/schemas/playback-progress.schema";
import { WatchHistory, WatchHistoryDocument } from "../database/schemas/watch-history.schema";
import { Episode, EpisodeDocument } from "../database/schemas/episode.schema";
import { Movie, MovieDocument } from "../database/schemas/movie.schema";
import { assertOwnsProfile } from "../common/assert-owns-profile";
import { SaveProgressDto } from "./dto/save-progress.dto";

const CONTINUE_WATCHING_MIN_SECONDS = 30;
const COMPLETION_RATIO = 0.95;

@Injectable()
export class PlaybackService {
  constructor(
    @InjectModel(Profile.name) private readonly profileModel: Model<ProfileDocument>,
    @InjectModel(PlaybackProgress.name) private readonly progressModel: Model<PlaybackProgressDocument>,
    @InjectModel(WatchHistory.name) private readonly historyModel: Model<WatchHistoryDocument>,
    @InjectModel(Episode.name) private readonly episodeModel: Model<EpisodeDocument>,
    @InjectModel(Movie.name) private readonly movieModel: Model<MovieDocument>
  ) {}

  async getContinueWatching(userId: string, profileId: string): Promise<ContinueWatchingItem[]> {
    await assertOwnsProfile(this.profileModel, userId, profileId);

    const rows = await this.progressModel
      .find({ profileId, completed: false, positionSeconds: { $gt: CONTINUE_WATCHING_MIN_SECONDS } })
      .sort({ lastWatchedAt: "desc" })
      .populate({
        path: "episodeId",
        populate: { path: "seasonId", populate: { path: "seriesId" } },
      })
      .populate("movieId");

    const items = rows
      .map((row): (ContinueWatchingItem & { groupKey: string }) | null => {
        const episode = row.episodeId as unknown as
          | (EpisodeDocument & { seasonId: { seasonNumber: number; seriesId: { id: string; title: string; posterUrl?: string; backdropUrl?: string } } })
          | null;
        const movie = row.movieId as unknown as MovieDocument | null;

        if (episode && episode.seasonId) {
          const season = episode.seasonId as any;
          const series = season.seriesId as any;
          return {
            groupKey: `series:${series?.id ?? season.id}`,
            profileId: row.profileId.toString(),
            positionSeconds: row.positionSeconds,
            durationSeconds: row.durationSeconds,
            completed: row.completed,
            lastWatchedAt: row.lastWatchedAt.toISOString(),
            kind: "episode",
            episodeId: episode.id,
            title: episode.title,
            seriesTitle: series?.title,
            seasonNumber: season.seasonNumber,
            episodeNumber: episode.episodeNumber,
            posterUrl: episode.thumbnailUrl ?? series?.posterUrl ?? null,
            backdropUrl: series?.backdropUrl ?? null,
          };
        }
        if (movie) {
          return {
            groupKey: `movie:${movie.id}`,
            profileId: row.profileId.toString(),
            positionSeconds: row.positionSeconds,
            durationSeconds: row.durationSeconds,
            completed: row.completed,
            lastWatchedAt: row.lastWatchedAt.toISOString(),
            kind: "movie",
            movieId: movie.id,
            title: movie.title,
            posterUrl: movie.posterUrl ?? null,
            backdropUrl: movie.backdropUrl ?? null,
          };
        }
        return null;
      })
      .filter((item): item is ContinueWatchingItem & { groupKey: string } => item !== null);

    // One Continue Watching card per show, not per episode: rows are already
    // sorted by lastWatchedAt desc, so the first row seen for a given
    // series/movie is the most recently watched one — e.g. watching E7 after
    // E6 replaces the card, and going back to rewatch E5 brings it back to E5.
    const seen = new Set<string>();
    const deduped: ContinueWatchingItem[] = [];
    for (const { groupKey, ...item } of items) {
      if (seen.has(groupKey)) continue;
      seen.add(groupKey);
      deduped.push(item);
    }
    return deduped;
  }

  async saveProgress(userId: string, profileId: string, dto: SaveProgressDto) {
    await assertOwnsProfile(this.profileModel, userId, profileId);

    if (!dto.episodeId && !dto.movieId) {
      throw new BadRequestException("episodeId or movieId is required");
    }
    if (dto.episodeId && dto.movieId) {
      throw new BadRequestException("Provide only one of episodeId or movieId");
    }

    const creditsStartSeconds = dto.episodeId
      ? (await this.episodeModel.findById(dto.episodeId))?.creditsStartSeconds
      : (await this.movieModel.findById(dto.movieId!))?.creditsStartSeconds;

    const completed =
      (creditsStartSeconds != null && dto.positionSeconds >= creditsStartSeconds) ||
      dto.positionSeconds / Math.max(dto.durationSeconds, 1) >= COMPLETION_RATIO;

    // No DB-level compound-unique index here (see playback-progress.schema.ts note),
    // so "one progress row per profile+content" is enforced with find-then-write.
    const existing = await this.progressModel.findOne(
      dto.episodeId ? { profileId, episodeId: dto.episodeId } : { profileId, movieId: dto.movieId }
    );
    // Captured before existing gets mutated below — Object.assign mutates it in
    // place, so checking existing.completed afterward would see the NEW value.
    const wasCompleted = existing?.completed ?? false;

    const fields = {
      positionSeconds: dto.positionSeconds,
      durationSeconds: dto.durationSeconds,
      completed,
      lastWatchedAt: new Date(),
    };

    let saved: PlaybackProgressDocument;
    if (existing) {
      Object.assign(existing, fields);
      saved = await existing.save();
    } else {
      saved = await this.progressModel.create({
        profileId,
        episodeId: dto.episodeId,
        movieId: dto.movieId,
        ...fields,
      });
    }

    if (completed && !wasCompleted) {
      await this.historyModel.create({
        profileId,
        episodeId: dto.episodeId,
        movieId: dto.movieId,
        completed: true,
      });
    }

    return saved;
  }

  async getHistory(userId: string, profileId: string) {
    await assertOwnsProfile(this.profileModel, userId, profileId);
    return this.historyModel.find({ profileId }).sort({ watchedAt: "desc" }).limit(100);
  }
}
