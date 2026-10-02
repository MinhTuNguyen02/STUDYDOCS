import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class TagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  tag_name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
}
