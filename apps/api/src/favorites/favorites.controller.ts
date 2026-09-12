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
import { FavoritesService } from "./favorites.service";
import { CreateFavoriteDto } from "./dto/create-favorite.dto";

@UseGuards(JwtAuthGuard)
@Controller("profiles/:profileId/favorites")
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Param("profileId") profileId: string) {
    return this.favoritesService.list(user.id, profileId);
  }

  @Post()
  add(
    @CurrentUser() user: RequestUser,
    @Param("profileId") profileId: string,
    @Body() dto: CreateFavoriteDto
  ) {
    return this.favoritesService.add(user.id, profileId, dto);
  }

  @Delete(":entryId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: RequestUser,
    @Param("profileId") profileId: string,
    @Param("entryId") entryId: string
  ) {
    await this.favoritesService.remove(user.id, profileId, entryId);
  }
}
