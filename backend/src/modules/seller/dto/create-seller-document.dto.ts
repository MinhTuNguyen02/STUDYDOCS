import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSellerDocumentDto {
  @ApiProperty({ example: 'Mẫu tài liệu/Sản phẩm' })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 'example value' })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(255)
  slug!: string;

  @ApiProperty({ example: 'Mô tả chi tiết về lý do hoặc nội dung' })
  @IsString()
  @MinLength(200)
  @MaxLength(10000)
  description!: string;

  @ApiProperty({ example: 'example value' })
  @IsString()
  categoryId!: string;

  @ApiProperty({ example: '1,2,3' })
  @IsOptional()
  @IsString()
  tagIds?: string;

  @ApiProperty({ example: 'example value' })
  @IsString()
  @Matches(/^(pdf|doc|docx|ppt|pptx|xls|xlsx)$/i)
  fileExtension!: string;

  @ApiProperty({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  fileSizeMb?: number;

  @ApiProperty({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageCount?: number;

  @ApiProperty({ example: 'example value' })
  @IsOptional()
  @IsString()
  storageKey?: string;

  @ApiProperty({ example: 'example value' })
  @IsOptional()
  @IsString()
  previewKey?: string;

  @ApiProperty({ example: 'example value' })
  @IsOptional()
  @IsString()
  fileHash?: string;

  @ApiProperty({ example: 'example value' })
  @IsString()
  price!: string;
}
