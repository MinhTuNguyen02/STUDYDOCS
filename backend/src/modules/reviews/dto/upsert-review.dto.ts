import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpsertReviewDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiProperty({ example: 'example value' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string;
}
