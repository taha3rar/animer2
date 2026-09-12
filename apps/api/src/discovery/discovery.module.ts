import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { AnizoneBrowserService } from "./anizone-browser.service";
import { AnizoneService } from "./anizone.service";
import { AnizoneEpisodesService } from "./anizone-episodes.service";
import { AnizoneVideoService } from "./anizone-video.service";
import { AnizoneProxyController } from "./anizone-proxy.controller";
import { AnizoneProxyService } from "./anizone-proxy.service";
import { DiscoveryController } from "./discovery.controller";
import { DiscoveryService } from "./discovery.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [DiscoveryController, AnizoneProxyController],
  providers: [
    AnizoneBrowserService,
    AnizoneService,
    AnizoneEpisodesService,
    AnizoneVideoService,
    AnizoneProxyService,
    DiscoveryService,
  ],
  exports: [DiscoveryService, AnizoneEpisodesService],
})
export class DiscoveryModule {}
