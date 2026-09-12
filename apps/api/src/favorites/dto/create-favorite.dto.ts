import { IsOptional, IsString } from "class-validator";

export class CreateFavoriteDto {
  @IsOptional()
  @IsString()
  seriesId?: string;

  @IsOptional()
  @IsString()
  movieId?: string;
}
