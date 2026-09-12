import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { PlaybackService } from "./playback.service";
import { SaveProgressDto } from "./dto/save-progress.dto";

@UseGuards(JwtAuthGuard)
@Controller("profiles/:profileId/progress")
export class ProgressController {
  constructor(private readonly playbackService: PlaybackService) {}

  @Get()
  getContinueWatching(@CurrentUser() user: RequestUser, @Param("profileId") profileId: string) {
    return this.playbackService.getContinueWatching(user.id, profileId);
  }

  @Put()
  saveProgress(
    @CurrentUser() user: RequestUser,
    @Param("profileId") profileId: string,
    @Body() dto: SaveProgressDto
  ) {
    return this.playbackService.saveProgress(user.id, profileId, dto);
  }
}
