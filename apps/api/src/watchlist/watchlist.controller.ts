import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { WatchlistService } from "./watchlist.service";
import { CreateWatchlistItemDto } from "./dto/create-watchlist-item.dto";

@UseGuards(JwtAuthGuard)
@Controller("profiles/:profileId/watchlist")
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Param("profileId") profileId: string) {
    return this.watchlistService.list(user.id, profileId);
  }

  @Post()
  add(
    @CurrentUser() user: RequestUser,
    @Param("profileId") profileId: string,
    @Body() dto: CreateWatchlistItemDto
  ) {
    return this.watchlistService.add(user.id, profileId, dto);
  }

  @Delete(":entryId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: RequestUser,
    @Param("profileId") profileId: string,
    @Param("entryId") entryId: string
  ) {
    await this.watchlistService.remove(user.id, profileId, entryId);
  }
}
