import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdatePreferencesDto {
  @IsOptional()
  @IsString()
  preferredAudioLanguage?: string;

  @IsOptional()
  @IsString()
  preferredSubtitleLanguage?: string;

  @IsOptional()
  @IsBoolean()
  subtitlesEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  autoplayNextEpisode?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  skipSecondsForward?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  skipSecondsBackward?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.25)
  @Max(2)
  defaultPlaybackSpeed?: number;
}
