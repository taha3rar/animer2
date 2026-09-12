import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class SaveProgressDto {
  @IsOptional()
  @IsString()
  episodeId?: string;

  @IsOptional()
  @IsString()
  movieId?: string;

  @IsInt()
  @Min(0)
  positionSeconds!: number;

  @IsInt()
  @Min(0)
  durationSeconds!: number;
}
