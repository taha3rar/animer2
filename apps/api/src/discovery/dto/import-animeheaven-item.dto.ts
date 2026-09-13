import { IsNotEmpty, IsOptional, IsString, IsUrl } from "class-validator";

export class ImportAnimeheavenItemDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsUrl()
  coverUrl?: string;
}
