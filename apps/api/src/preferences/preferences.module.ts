import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { PreferencesService } from "./preferences.service";
import { PreferencesController } from "./preferences.controller";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [PreferencesController],
  providers: [PreferencesService],
})
export class PreferencesModule {}
