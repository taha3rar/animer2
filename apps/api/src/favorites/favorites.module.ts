import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { FavoritesService } from "./favorites.service";
import { FavoritesController } from "./favorites.controller";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
