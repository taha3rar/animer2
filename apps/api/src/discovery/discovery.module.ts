import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { AnizoneService } from "./anizone.service";
import { AnizoneEpisodesService } from "./anizone-episodes.service";
import { AnizoneVideoService } from "./anizone-video.service";
import { AnizoneProxyController } from "./anizone-proxy.controller";
import { AnizoneProxyService } from "./anizone-proxy.service";
import { AnimeheavenService } from "./animeheaven.service";
import { AnimeheavenEpisodesService } from "./animeheaven-episodes.service";
import { AnimeheavenVideoService } from "./animeheaven-video.service";
import { AnimeheavenController } from "./animeheaven.controller";
import { DiscoveryController } from "./discovery.controller";
import { DiscoveryService } from "./discovery.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [DiscoveryController, AnizoneProxyController, AnimeheavenController],
  providers: [
    AnizoneService,
    AnizoneEpisodesService,
    AnizoneVideoService,
    AnizoneProxyService,
    AnimeheavenService,
    AnimeheavenEpisodesService,
    AnimeheavenVideoService,
    DiscoveryService,
  ],
  exports: [DiscoveryService, AnizoneEpisodesService, AnimeheavenEpisodesService],
})
export class DiscoveryModule {}
