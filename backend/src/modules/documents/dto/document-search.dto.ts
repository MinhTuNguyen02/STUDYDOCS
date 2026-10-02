import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DocumentSearchDto {
  @ApiProperty({ example: 'example value' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ example: 'example value' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({ example: 'example value' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  categoryId?: number;

  @IsOptional()
  @Type(() => Number)
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  tagId?: number;

  @IsOptional()
  @Type(() => Number)
  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsIn(['newest', 'popular', 'price_asc', 'price_desc'])
  sortBy?: 'newest' | 'popular' | 'price_asc' | 'price_desc';
}
