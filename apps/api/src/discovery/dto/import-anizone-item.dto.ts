import { IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from "class-validator";

export class ImportAnizoneItemDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsUrl()
  sourceUrl?: string;

  @IsOptional()
  @IsUrl()
  coverUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  startYear?: number;
}
