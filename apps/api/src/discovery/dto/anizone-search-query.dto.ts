import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class AnizoneSearchQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  q!: string;
}
