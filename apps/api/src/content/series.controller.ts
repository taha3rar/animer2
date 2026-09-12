import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ContentService } from "./content.service";

@UseGuards(JwtAuthGuard)
@Controller("series")
export class SeriesController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  findAll() {
    return this.contentService.getAllSeries();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.contentService.getSeriesDetail(id);
  }
}
