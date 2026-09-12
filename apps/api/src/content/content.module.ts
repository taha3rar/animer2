import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { DiscoveryModule } from "../discovery/discovery.module";
import { ContentService } from "./content.service";
import { SeriesController } from "./series.controller";
import { MoviesController } from "./movies.controller";
import { EpisodesController } from "./episodes.controller";

@Module({
  imports: [AuthModule, DatabaseModule, DiscoveryModule],
  controllers: [SeriesController, MoviesController, EpisodesController],
  providers: [ContentService],
})
export class ContentModule {}
