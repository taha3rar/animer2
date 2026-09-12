import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { WatchlistService } from "./watchlist.service";
import { WatchlistController } from "./watchlist.controller";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [WatchlistController],
  providers: [WatchlistService],
})
export class WatchlistModule {}
