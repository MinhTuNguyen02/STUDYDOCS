import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

const toOptionalNumber = ({ value }: { value: unknown }) =>
  value === '' || value === null || value === undefined ? undefined : Number(value);

export class DocumentSearchDto {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({ example: 'toán học', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  keyword?: string;

  @IsOptional()
  @Transform(toOptionalNumber)
  @ApiProperty({ example: 1, required: false })
  @IsInt()
  @Min(1)
  categoryId?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @ApiProperty({ example: 1, required: false })
  @IsInt()
  @Min(1)
  tagId?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @ApiProperty({ example: 0, required: false })
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @ApiProperty({ example: 100000, required: false })
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsIn(['newest', 'popular', 'price_asc', 'price_desc'])
  sortBy?: 'newest' | 'popular' | 'price_asc' | 'price_desc';
}
