import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumberString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class DocumentSearchDto {
  @ApiProperty({ example: 'example value' })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiProperty({ example: 'example value' })
  @IsOptional()
  @IsNumberString()
  limit?: string;

  @ApiProperty({ example: 'example value' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @ApiProperty({ example: 1 })
  @IsNumber()
  categoryId?: number;

  @IsOptional()
  @Type(() => Number)
  @ApiProperty({ example: 1 })
  @IsNumber()
  tagId?: number;

  @IsOptional()
  @Type(() => Number)
  @ApiProperty({ example: 1 })
  @IsNumber()
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @ApiProperty({ example: 1 })
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @IsString()
  sortBy?: 'newest' | 'popular' | 'price_asc' | 'price_desc';
}
