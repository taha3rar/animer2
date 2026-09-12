import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsBoolean()
  isKidsProfile?: boolean;
}
