import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ContentService } from "./content.service";

@UseGuards(JwtAuthGuard)
@Controller("movies")
export class MoviesController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  findAll() {
    return this.contentService.getAllMovies();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.contentService.getMovie(id);
  }
}
