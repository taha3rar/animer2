import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { PlaybackService } from "./playback.service";
import { ProgressController } from "./progress.controller";
import { HistoryController } from "./history.controller";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [ProgressController, HistoryController],
  providers: [PlaybackService],
})
export class PlaybackModule {}
