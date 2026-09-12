import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "./schemas/user.schema";
import { RefreshToken, RefreshTokenSchema } from "./schemas/refresh-token.schema";
import { Profile, ProfileSchema } from "./schemas/profile.schema";
import { ProfilePreferences, ProfilePreferencesSchema } from "./schemas/profile-preferences.schema";
import { Series, SeriesSchema } from "./schemas/series.schema";
import { Season, SeasonSchema } from "./schemas/season.schema";
import { Episode, EpisodeSchema } from "./schemas/episode.schema";
import { Movie, MovieSchema } from "./schemas/movie.schema";
import { PlaybackProgress, PlaybackProgressSchema } from "./schemas/playback-progress.schema";
import { WatchHistory, WatchHistorySchema } from "./schemas/watch-history.schema";
import { WatchlistItem, WatchlistItemSchema } from "./schemas/watchlist-item.schema";
import { FavoriteItem, FavoriteItemSchema } from "./schemas/favorite-item.schema";
import { AnizoneEpisodeCache, AnizoneEpisodeCacheSchema } from "./schemas/anizone-episode-cache.schema";

// Every model is registered here, once, and every feature module (including
// apps/api/src/discovery) imports DatabaseModule to inject whichever it needs —
// avoids re-declaring schemas per module for what is still a small app.
const models = MongooseModule.forFeature([
  { name: User.name, schema: UserSchema },
  { name: RefreshToken.name, schema: RefreshTokenSchema },
  { name: Profile.name, schema: ProfileSchema },
  { name: ProfilePreferences.name, schema: ProfilePreferencesSchema },
  { name: Series.name, schema: SeriesSchema },
  { name: Season.name, schema: SeasonSchema },
  { name: Episode.name, schema: EpisodeSchema },
  { name: Movie.name, schema: MovieSchema },
  { name: PlaybackProgress.name, schema: PlaybackProgressSchema },
  { name: WatchHistory.name, schema: WatchHistorySchema },
  { name: WatchlistItem.name, schema: WatchlistItemSchema },
  { name: FavoriteItem.name, schema: FavoriteItemSchema },
  { name: AnizoneEpisodeCache.name, schema: AnizoneEpisodeCacheSchema },
]);

@Module({
  imports: [models],
  exports: [models],
})
export class DatabaseModule {}
