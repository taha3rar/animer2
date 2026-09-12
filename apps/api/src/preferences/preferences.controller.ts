import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { PreferencesService } from "./preferences.service";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";

@UseGuards(JwtAuthGuard)
@Controller("profiles/:profileId/preferences")
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  get(@CurrentUser() user: RequestUser, @Param("profileId") profileId: string) {
    return this.preferencesService.get(user.id, profileId);
  }

  @Patch()
  update(
    @CurrentUser() user: RequestUser,
    @Param("profileId") profileId: string,
    @Body() dto: UpdatePreferencesDto
  ) {
    return this.preferencesService.update(user.id, profileId, dto);
  }
}
