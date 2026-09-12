import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { PlaybackService } from "./playback.service";

@UseGuards(JwtAuthGuard)
@Controller("profiles/:profileId/history")
export class HistoryController {
  constructor(private readonly playbackService: PlaybackService) {}

  @Get()
  getHistory(@CurrentUser() user: RequestUser, @Param("profileId") profileId: string) {
    return this.playbackService.getHistory(user.id, profileId);
  }
}
