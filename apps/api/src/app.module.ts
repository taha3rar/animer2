import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./auth/auth.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { ContentModule } from "./content/content.module";
import { PlaybackModule } from "./playback/playback.module";
import { WatchlistModule } from "./watchlist/watchlist.module";
import { FavoritesModule } from "./favorites/favorites.module";
import { PreferencesModule } from "./preferences/preferences.module";
import { DiscoveryModule } from "./discovery/discovery.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.DATABASE_URL!),
    DatabaseModule,
    AuthModule,
    ProfilesModule,
    ContentModule,
    PlaybackModule,
    WatchlistModule,
    FavoritesModule,
    PreferencesModule,
    DiscoveryModule,
  ],
})
export class AppModule {}
