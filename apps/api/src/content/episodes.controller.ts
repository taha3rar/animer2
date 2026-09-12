import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ContentService } from "./content.service";

@UseGuards(JwtAuthGuard)
@Controller("episodes")
export class EpisodesController {
  constructor(private readonly contentService: ContentService) {}

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.contentService.getEpisode(id);
  }

  @Get(":id/context")
  getContext(@Param("id") id: string) {
    return this.contentService.getEpisodeContext(id);
  }
}
