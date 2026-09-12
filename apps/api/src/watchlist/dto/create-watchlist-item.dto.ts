import { IsOptional, IsString } from "class-validator";

export class CreateWatchlistItemDto {
  @IsOptional()
  @IsString()
  seriesId?: string;

  @IsOptional()
  @IsString()
  movieId?: string;
}
